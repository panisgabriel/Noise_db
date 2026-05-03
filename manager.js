// ============================================================
//  NoiseSense – manager.js  (MySQL edition)
// ============================================================

const TITLES = {
  live:'Live Monitor', rooms:'Room Management', alerts:'Alert Records',
  reports:'Reports', config:'Alert Configuration', account:'Account Settings',
};

async function init() {
  if (!currentUser || currentUser.role !== 'manager') {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('sb-name').textContent = currentUser.name;
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
    case 'config':  renderConfig(el, true); break;
    case 'account': renderAccount(el);      break;
  }
}

function renderRooms(el) {
  el.innerHTML = `
<div class="card">
  <div class="card-title">All rooms</div>
  <div id="room-list">${buildRoomList()}</div>
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
      </div>
    </div>`;
  }).join('');
}

function refreshRoomList() {
  const el = document.getElementById('room-list');
  if (el) el.innerHTML = buildRoomList();
}

function ackRoom(i) { toast(`${ROOMS[i].name} acknowledged`); }

init();
