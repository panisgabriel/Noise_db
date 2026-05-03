// ============================================================
//  NoiseSense – admin.js  (MySQL edition)
//  Panels: Live, Rooms, Alerts, Reports, Users, Logs, Config, Account
// ============================================================

const TITLES = {
  live:'Live Monitor', rooms:'Room Management', alerts:'Alert Records',
  reports:'Reports', users:'User Management', logs:'System Logs',
  config:'Alert Configuration', account:'Account Settings',
};

async function init() {
  if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('sb-name').textContent = currentUser.name;

  // Load initial data from MySQL
  await Promise.all([loadRooms(), loadAlerts(), loadConfig()]);

  showPanel('live');
  startClock();
  startSim(() => {
    const ap  = document.querySelector('.panel.active');
    if (!ap) return;
    const pid = ap.id.replace('panel-', '');
    if (pid === 'live')  refreshLive();
    if (pid === 'rooms') refreshRoomList();
  });
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el  = document.getElementById('panel-' + id);
  const nav = document.getElementById('nav-'   + id);
  if (!el) return;
  el.classList.add('active');
  if (nav) nav.classList.add('active');
  document.getElementById('topbar-title').textContent = TITLES[id] || id;
  renderPanel(id);
}

function renderPanel(id) {
  const el = document.getElementById('panel-' + id);
  if (!el) return;
  switch (id) {
    case 'live':    renderLive(el);         break;
    case 'rooms':   renderRooms(el);        break;
    case 'alerts':  renderAlerts(el, true); break;
    case 'reports': renderReports(el);      break;
    case 'users':   renderUsersPanel(el);   break;
    case 'logs':    renderLogsPanel(el);    break;
    case 'config':  renderConfig(el, true); break;
    case 'account': renderAccount(el);      break;
  }
}

// ── ROOMS ──────────────────────────────────────────────────────
function renderRooms(el) {
  el.innerHTML = `
<div class="card">
  <div class="card-title">All rooms</div>
  <div id="room-list">${buildRoomList()}</div>
  <div class="form-row">
    <input class="field" id="new-room" placeholder="New room name…">
    <button class="btn-small" onclick="addRoom()">Add Room</button>
  </div>
</div>
<div class="grid-3">
  <div class="card" style="margin-bottom:0;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--green)">${ROOMS.filter(r=>r.status==='Normal').length}</div><div style="font-size:12px;color:var(--muted);margin-top:4px">Normal</div></div>
  <div class="card" style="margin-bottom:0;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--amber)">${ROOMS.filter(r=>r.status==='Warning').length}</div><div style="font-size:12px;color:var(--muted);margin-top:4px">Warning</div></div>
  <div class="card" style="margin-bottom:0;text-align:center"><div style="font-size:28px;font-weight:700;color:var(--red)">${ROOMS.filter(r=>r.status==='Critical').length}</div><div style="font-size:12px;color:var(--muted);margin-top:4px">Critical</div></div>
</div>`;
}

function buildRoomList() {
  return ROOMS.map((r, i) => {
    const s = sev(r.db);
    return `<div class="room-row">
      <div><div class="room-name">${r.name}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Last updated just now</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="room-db">${Math.round(r.db)} dB</span>
        <span class="pill ${s.cls}">${s.label}</span>
        <button class="action-btn" onclick="ackRoom(${i})">✔ Ack</button>
        <button class="action-btn danger" onclick="delRoom(${r.id},'${r.name.replace(/'/g,"\\'")}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function refreshRoomList() {
  const el = document.getElementById('room-list');
  if (el) el.innerHTML = buildRoomList();
}

async function addRoom() {
  const inp  = document.getElementById('new-room');
  const name = inp.value.trim();
  if (!name) return;
  const data = await apiFetch('rooms.php', {
    method: 'POST',
    body: JSON.stringify({ name, lat: 8.359 + Math.random() * .001, lng: 124.869 + Math.random() * .001 }),
  });
  if (!data?.ok) { toast(data?.error ?? 'Failed to add room'); return; }
  await loadRooms();
  inp.value = '';
  renderRooms(document.getElementById('panel-rooms'));
  toast(`Room "${name}" added`);
}

async function delRoom(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  const data = await apiFetch('rooms.php', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
  if (!data?.ok) { toast(data?.error ?? 'Failed to delete'); return; }
  await loadRooms();
  renderRooms(document.getElementById('panel-rooms'));
  toast(`Room "${name}" deleted`);
}

function ackRoom(i) { toast(`${ROOMS[i].name} acknowledged`); }

// ── USERS ──────────────────────────────────────────────────────
let ALL_USERS = [];

async function renderUsersPanel(el) {
  const data = await apiFetch('users.php');
  ALL_USERS = data?.users ?? [];

  el.innerHTML = `
<div class="card">
  <div class="card-title">All users</div>
  <table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
    <tbody>${ALL_USERS.map((u) => `<tr>
      <td style="font-weight:500">${u.name}</td>
      <td style="color:var(--muted)">${u.email}</td>
      <td><span class="pill ${u.role==='admin'?'critical':u.role==='manager'?'warning':'normal'}">${u.role}</span></td>
      <td>
        <select class="field" style="display:inline;width:auto;padding:4px 8px;font-size:12px" onchange="changeRole(${u.id},this.value)">
          <option ${u.role==='user'?'selected':''} value="user">user</option>
          <option ${u.role==='manager'?'selected':''} value="manager">manager</option>
          <option ${u.role==='admin'?'selected':''} value="admin">admin</option>
        </select>
        ${u.id != currentUser.id
          ? `<button class="action-btn danger" onclick="delUser(${u.id},'${u.name.replace(/'/g,"\\'")}')">Delete</button>`
          : '<span style="font-size:11px;color:var(--muted);margin-left:8px">(you)</span>'}
      </td>
    </tr>`).join('')}</tbody>
  </table>
  <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px">
    <div class="card-title" style="margin-bottom:10px">Add new user</div>
    <div class="form-row">
      <input class="field" id="nu-name"  placeholder="Full name">
      <input class="field" id="nu-email" placeholder="Email">
      <input class="field" id="nu-pass"  type="password" placeholder="Password">
      <select class="field" id="nu-role" style="width:auto">
        <option value="user">user</option>
        <option value="manager">manager</option>
        <option value="admin">admin</option>
      </select>
      <button class="btn-small" onclick="addUser()">Add</button>
    </div>
  </div>
</div>`;
}

async function changeRole(id, role) {
  const data = await apiFetch('users.php', { method: 'PUT', body: JSON.stringify({ id, role }) });
  if (!data?.ok) { toast(data?.error ?? 'Failed to update role'); return; }
  toast('Role updated');
  renderUsersPanel(document.getElementById('panel-users'));
}

async function delUser(id, name) {
  if (!confirm(`Delete user "${name}"?`)) return;
  const data = await apiFetch('users.php', { method: 'DELETE', body: JSON.stringify({ id }) });
  if (!data?.ok) { toast(data?.error ?? 'Failed to delete'); return; }
  toast('User deleted');
  renderUsersPanel(document.getElementById('panel-users'));
}

async function addUser() {
  const name  = document.getElementById('nu-name').value.trim();
  const email = document.getElementById('nu-email').value.trim();
  const pass  = document.getElementById('nu-pass').value;
  const role  = document.getElementById('nu-role').value;
  if (!name || !email || !pass) { toast('Fill all fields'); return; }

  const data = await apiFetch('users.php', {
    method: 'POST',
    body: JSON.stringify({ name, email, password: pass, role }),
  });
  if (!data?.ok) { toast(data?.error ?? 'Failed to add user'); return; }
  toast(`User "${name}" added`);
  renderUsersPanel(document.getElementById('panel-users'));
}

// ── LOGS ───────────────────────────────────────────────────────
async function renderLogsPanel(el) {
  const data = await apiFetch('logs.php');
  const logs = data?.logs ?? [];
  el.innerHTML = `
<div class="card">
  <div class="card-title">System activity log</div>
  <table class="data-table">
    <thead><tr><th>User</th><th>Action</th><th>IP</th><th>Time</th></tr></thead>
    <tbody>${logs.map(l => `<tr>
      <td style="font-weight:500">${l.user}</td>
      <td>${l.action}</td>
      <td style="font-family:var(--mono);font-size:12px">${l.ip}</td>
      <td style="color:var(--muted)">${l.time}</td>
    </tr>`).join('')}</tbody>
  </table>
</div>`;
}

// ── BOOT ───────────────────────────────────────────────────────
init();
