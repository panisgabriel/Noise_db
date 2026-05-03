// ========== ADMIN DASHBOARD ==========
// Panels: Live, Rooms, Alerts, Reports, Users, Logs, Config, Account

const TITLES = {
  live:'Live Monitor', rooms:'Room Management', alerts:'Alert Records',
  reports:'Reports', users:'User Management', logs:'System Logs',
  config:'Alert Configuration', account:'Account Settings',
};

function init() {
  if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('sb-name').textContent = currentUser.name;
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
    case 'live':    renderLive(el);              break;
    case 'rooms':   renderRooms(el);             break;
    case 'alerts':  renderAlerts(el, true);      break;
    case 'reports': renderReports(el);           break;
    case 'users':   renderUsers(el);             break;
    case 'logs':    renderLogs(el);              break;
    case 'config':  renderConfig(el, true);      break;
    case 'account': renderAccount(el);           break;
  }
}

// --- ROOMS (admin: can add/delete) ---
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
        <button class="action-btn danger" onclick="delRoom(${i})">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function refreshRoomList() {
  const el = document.getElementById('room-list');
  if (el) el.innerHTML = buildRoomList();
}

function addRoom() {
  const inp  = document.getElementById('new-room');
  const name = inp.value.trim();
  if (!name) return;
  ROOMS.push({id:Date.now(), name, lat:8.359+Math.random()*.001, lng:124.869+Math.random()*.001, status:'Normal', db:50});
  LOGS.unshift({user:currentUser.name, action:`Added room: ${name}`, ip:'127.0.0.1', time:fmt()});
  inp.value = '';
  saveState();
  renderRooms(document.getElementById('panel-rooms'));
  toast(`Room "${name}" added`);
}

function delRoom(i) {
  if (!confirm(`Delete "${ROOMS[i].name}"?`)) return;
  const n = ROOMS[i].name;
  ROOMS.splice(i, 1);
  LOGS.unshift({user:currentUser.name, action:`Deleted room: ${n}`, ip:'127.0.0.1', time:fmt()});
  saveState();
  renderRooms(document.getElementById('panel-rooms'));
  toast(`Room "${n}" deleted`);
}

function ackRoom(i) { toast(`${ROOMS[i].name} acknowledged`); }

// --- USERS (admin only) ---
function renderUsers(el) {
  el.innerHTML = `
<div class="card">
  <div class="card-title">All users</div>
  <table class="data-table">
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
    <tbody>${USERS.map((u, i) => `<tr>
      <td style="font-weight:500">${u.name}</td>
      <td style="color:var(--muted)">${u.email}</td>
      <td><span class="pill ${u.role==='admin'?'critical':u.role==='manager'?'warning':'normal'}">${u.role}</span></td>
      <td>
        <select class="field" style="display:inline;width:auto;padding:4px 8px;font-size:12px" onchange="changeRole(${i},this.value)">
          <option ${u.role==='user'?'selected':''} value="user">user</option>
          <option ${u.role==='manager'?'selected':''} value="manager">manager</option>
          <option ${u.role==='admin'?'selected':''} value="admin">admin</option>
        </select>
        ${u.id !== currentUser.id
          ? `<button class="action-btn danger" onclick="delUser(${i})" style="margin-left:6px">Delete</button>`
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

function changeRole(i, role) {
  USERS[i].role = role;
  LOGS.unshift({user:currentUser.name, action:`Changed ${USERS[i].name} role to ${role}`, ip:'127.0.0.1', time:fmt()});
  saveState();
  renderUsers(document.getElementById('panel-users'));
  toast('Role updated');
}

function delUser(i) {
  if (!confirm(`Delete user "${USERS[i].name}"?`)) return;
  const n = USERS[i].name;
  USERS.splice(i, 1);
  LOGS.unshift({user:currentUser.name, action:`Deleted user: ${n}`, ip:'127.0.0.1', time:fmt()});
  saveState();
  renderUsers(document.getElementById('panel-users'));
  toast('User deleted');
}

function addUser() {
  const name  = document.getElementById('nu-name').value.trim();
  const email = document.getElementById('nu-email').value.trim();
  const pass  = document.getElementById('nu-pass').value;
  const role  = document.getElementById('nu-role').value;
  if (!name || !email || !pass) { toast('Fill all fields'); return; }
  if (USERS.find(u => u.email === email)) { toast('Email already exists'); return; }
  USERS.push({id:Date.now(), name, email, password:pass, role});
  LOGS.unshift({user:currentUser.name, action:`Added user: ${name}`, ip:'127.0.0.1', time:fmt()});
  saveState();
  renderUsers(document.getElementById('panel-users'));
  toast(`User "${name}" added`);
}

// --- LOGS (admin only) ---
function renderLogs(el) {
  el.innerHTML = `
<div class="card">
  <div class="card-title">System activity log</div>
  <table class="data-table">
    <thead><tr><th>User</th><th>Action</th><th>IP</th><th>Time</th></tr></thead>
    <tbody>${LOGS.slice(0,40).map(l => `<tr>
      <td style="font-weight:500">${l.user}</td>
      <td>${l.action}</td>
      <td style="font-family:var(--mono);font-size:12px">${l.ip}</td>
      <td style="color:var(--muted)">${l.time}</td>
    </tr>`).join('')}</tbody>
  </table>
</div>`;
}

// ========== BOOT ==========
init();
