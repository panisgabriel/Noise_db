// ========== SHARED STATE ==========
// Persisted in sessionStorage so it survives page redirects

function loadState() {
  const raw = sessionStorage.getItem('ns_state');
  if (raw) return JSON.parse(raw);
  return {
    users: [
      {id:1,name:'Admin User',email:'admin@example.com',password:'admin123',role:'admin'},
      {id:2,name:'Manager User',email:'manager@example.com',password:'manager123',role:'manager'},
      {id:3,name:'Regular User',email:'user@example.com',password:'user123',role:'user'},
    ],
    rooms: [
      {id:1,name:'Laboratory 1',lat:8.359731,lng:124.869193,status:'Normal',db:52},
      {id:2,name:'Laboratory 2',lat:8.359675,lng:124.869180,status:'Normal',db:48},
      {id:3,name:'Laboratory 3',lat:8.359619,lng:124.869167,status:'Normal',db:55},
    ],
    alerts: [],
    logs: [{user:'System',action:'Application started',ip:'127.0.0.1',time:new Date().toLocaleString()}],
    config: {warnThreshold:65,critThreshold:80,emailAlerts:true,soundAlerts:false,visualAlerts:true,recipient:'admin@noisesense.com'},
    currentUserId: null,
  };
}

function saveState() {
  sessionStorage.setItem('ns_state', JSON.stringify({
    users: USERS, rooms: ROOMS, alerts: ALERTS, logs: LOGS,
    config: CONFIG, currentUserId: currentUser ? currentUser.id : null,
  }));
}

const _state   = loadState();
const USERS    = _state.users;
const ROOMS    = _state.rooms;
const ALERTS   = _state.alerts;
const LOGS     = _state.logs;
const CONFIG   = _state.config;
let currentUser = _state.currentUserId ? USERS.find(u => u.id === _state.currentUserId) : null;

// ========== UTILS ==========
function fmt(){ return new Date().toLocaleString(); }
function ts(){  return new Date().toLocaleTimeString(); }
function sev(db){
  if (db >= CONFIG.critThreshold) return {label:'Critical', cls:'critical'};
  if (db >= CONFIG.warnThreshold) return {label:'Warning',  cls:'warning'};
  return {label:'Normal', cls:'normal'};
}
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}
function initials(n){ return n.split(' ').map(w => w[0]).join('').toUpperCase(); }

// ========== SHARED SIMULATION ==========
let chartInst    = null;
let chartData    = [52,58,55,63,60,48,54,61,57,52,65,50];
let mapInst      = null;
let mapMarkers   = [];
let selectedRoom = 0;

function startSim(onTick) {
  setInterval(() => {
    ROOMS.forEach(r => {
      r.db = Math.max(30, Math.min(105, r.db + (Math.random() * 10 - 5)));
      const s = sev(r.db);
      if (s.label !== r.status && s.label !== 'Normal') {
        ALERTS.unshift({room:r.name, db:Math.round(r.db), severity:s.label, time:ts(), resolved:false});
        if (ALERTS.length > 60) ALERTS.pop();
      }
      r.status = s.label;
    });
    // Alert badge
    const crit  = ALERTS.filter(a => !a.resolved && a.severity === 'Critical').length;
    const badge = document.getElementById('alert-badge');
    if (badge) { if (crit > 0) { badge.style.display='inline'; badge.textContent=crit; } else badge.style.display='none'; }
    // Chart
    chartData.push(Math.round(ROOMS[selectedRoom].db));
    if (chartData.length > 14) chartData.shift();
    if (chartInst) { chartInst.data.datasets[0].data = [...chartData]; chartInst.update('none'); }
    // Map markers
    if (mapInst && mapMarkers.length) {
      mapMarkers.forEach((m, i) => {
        const r = ROOMS[i]; const s = sev(r.db);
        const col = s.cls==='critical'?'#ef5356':s.cls==='warning'?'#f59e0b':'#22d3a0';
        m.setIcon(L.divIcon({html:`<div style="width:14px;height:14px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 0 0 4px ${col}44"></div>`,iconSize:[14,14],iconAnchor:[7,7]}));
        m.bindPopup(`<b>${r.name}</b><br>${Math.round(r.db)} dB — ${s.label}`);
      });
    }
    saveState();
    if (onTick) onTick();
  }, 2500);
}

// ========== SHARED PANEL RENDERERS ==========
// These are used by all three dashboards

function renderLive(el) {
  const r   = ROOMS[selectedRoom];
  const db  = Math.round(r.db);
  const s   = sev(db);
  const pct = Math.min(100, Math.round((db - 30) / 80 * 100));
  const bc  = s.cls==='critical'?'var(--red)':s.cls==='warning'?'var(--amber)':'var(--green)';
  el.innerHTML = `
<div class="grid-3">
  ${ROOMS.map((rm,i) => {
    const rs = sev(rm.db);
    const rbc = rs.cls==='critical'?'var(--red)':rs.cls==='warning'?'var(--amber)':'var(--green)';
    return `<div class="card" style="cursor:pointer;border-color:${i===selectedRoom?'var(--accent)':'var(--border)'};margin-bottom:0" onclick="selRoom(${i})">
      <div class="card-title">${rm.name}</div>
      <div class="stat-val" style="color:${rbc}">${Math.round(rm.db)}<span style="font-size:15px;color:var(--muted)"> dB</span></div>
      <div style="margin-top:8px"><span class="pill ${rs.cls}">${rs.label}</span></div>
    </div>`;
  }).join('')}
</div>
<div class="grid-2">
  <div class="card">
    <div class="card-title">Live intensity — ${r.name}</div>
    <div class="db-meter">
      <div class="db-number" id="live-db-num" style="color:${bc}">${db}<span class="db-unit"> dB</span></div>
      <div class="db-bar-wrap"><div class="db-bar" id="live-bar" style="width:${pct}%;background:${bc}"></div></div>
      <div style="margin-top:6px"><span class="pill ${s.cls}">${s.label}</span></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Noise trend (recent readings)</div>
    <div class="chart-wrap"><canvas id="liveChart"></canvas></div>
  </div>
</div>
<div class="card">
  <div class="card-title">Campus map</div>
  <div id="liveMap"></div>
</div>`;
  setTimeout(() => {
    const ctx = document.getElementById('liveChart');
    if (!ctx) return;
    if (chartInst) chartInst.destroy();
    chartInst = new Chart(ctx, {type:'line',data:{labels:chartData.map((_,i)=>i+''),datasets:[{data:[...chartData],borderColor:'#4f7fff',borderWidth:2.5,pointRadius:0,fill:true,backgroundColor:'rgba(79,127,255,.08)',tension:.4}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false,min:25,max:110}}}});
    if (mapInst) mapInst.remove();
    mapMarkers = [];
    mapInst = L.map('liveMap').setView([8.3597, 124.8691], 18);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution:'© OpenStreetMap'}).addTo(mapInst);
    ROOMS.forEach((rm, i) => {
      const rs = sev(rm.db);
      const col = rs.cls==='critical'?'#ef5356':rs.cls==='warning'?'#f59e0b':'#22d3a0';
      const m = L.marker([rm.lat, rm.lng], {icon:L.divIcon({html:`<div style="width:14px;height:14px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 0 0 4px ${col}44"></div>`,iconSize:[14,14],iconAnchor:[7,7]})}).addTo(mapInst).bindPopup(`<b>${rm.name}</b><br>${Math.round(rm.db)} dB — ${rs.label}`);
      mapMarkers.push(m);
    });
  }, 60);
}

function refreshLive() {
  const r   = ROOMS[selectedRoom];
  const db  = Math.round(r.db);
  const s   = sev(db);
  const bc  = s.cls==='critical'?'var(--red)':s.cls==='warning'?'var(--amber)':'var(--green)';
  const pct = Math.min(100, Math.round((db - 30) / 80 * 100));
  const numEl = document.getElementById('live-db-num');
  const barEl = document.getElementById('live-bar');
  if (numEl) { numEl.innerHTML = `${db}<span class="db-unit"> dB</span>`; numEl.style.color = bc; }
  if (barEl) { barEl.style.width = pct + '%'; barEl.style.background = bc; }
  ROOMS.forEach((rm, i) => {
    const rs  = sev(rm.db);
    const rbc = rs.cls==='critical'?'var(--red)':rs.cls==='warning'?'var(--amber)':'var(--green)';
    const cardEl = document.querySelector(`#panel-live .grid-3 .card:nth-child(${i+1}) .stat-val`);
    if (cardEl) { cardEl.innerHTML = `${Math.round(rm.db)}<span style="font-size:15px;color:var(--muted)"> dB</span>`; cardEl.style.color = rbc; }
  });
}

function selRoom(i) {
  selectedRoom = i;
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  const el = document.getElementById('panel-live');
  if (el) renderLive(el);
}

function renderAlerts(el, canAct) {
  const list = ALERTS.length ? ALERTS.slice(0,30) : [{room:'No alerts yet',db:'—',severity:'Normal',time:'—',resolved:false}];
  el.innerHTML = `
<div class="card">
  <div class="card-title">Alert history</div>
  <table class="data-table">
    <thead><tr><th>Room</th><th>dB Level</th><th>Severity</th><th>Time</th><th>Status</th>${canAct?'<th>Action</th>':''}</tr></thead>
    <tbody>${list.map((a,i) => `<tr>
      <td style="font-weight:500">${a.room}</td>
      <td style="font-family:var(--mono)">${a.db==='—'?'—':a.db+' dB'}</td>
      <td><span class="pill ${a.severity.toLowerCase()}">${a.severity}</span></td>
      <td style="color:var(--muted)">${a.time}</td>
      <td>${a.resolved?'<span style="color:var(--green);font-size:12px">Resolved</span>':'<span style="color:var(--muted);font-size:12px">Open</span>'}</td>
      ${canAct?`<td>${!a.resolved&&a.db!=='—'?`<button class="action-btn" onclick="resolveAlert(${i})">Resolve</button>`:'—'}</td>`:''}`
    ).join('')}</tbody>
  </table>
</div>`;
}

function resolveAlert(i) {
  ALERTS[i].resolved = true;
  LOGS.unshift({user:currentUser.name, action:`Resolved alert for ${ALERTS[i].room}`, ip:'127.0.0.1', time:fmt()});
  const el = document.getElementById('panel-alerts');
  if (el) renderAlerts(el, ['admin','manager'].includes(currentUser.role));
  saveState();
  toast('Alert resolved');
}

function renderReports(el) {
  el.innerHTML = `
<div class="grid-3">
  <div class="card" style="margin-bottom:0"><div class="card-title">Avg dB today</div><div class="stat-val">${Math.round(ROOMS.reduce((s,r)=>s+r.db,0)/ROOMS.length)}<span style="font-size:16px;color:var(--muted)"> dB</span></div></div>
  <div class="card" style="margin-bottom:0"><div class="card-title">Total alerts</div><div class="stat-val">${ALERTS.length}</div></div>
  <div class="card" style="margin-bottom:0"><div class="card-title">Rooms monitored</div><div class="stat-val">${ROOMS.length}</div></div>
</div>
<div class="card">
  <div class="card-title">Per-room summary</div>
  <table class="data-table">
    <thead><tr><th>Room</th><th>Current dB</th><th>Peak dB</th><th>Status</th><th>Alerts</th></tr></thead>
    <tbody>${ROOMS.map(r => { const s = sev(r.db); return `<tr>
      <td style="font-weight:500">${r.name}</td>
      <td style="font-family:var(--mono)">${Math.round(r.db)}</td>
      <td style="font-family:var(--mono)">${Math.round(r.db+5)}</td>
      <td><span class="pill ${s.cls}">${s.label}</span></td>
      <td>${ALERTS.filter(a=>a.room===r.name).length}</td>
    </tr>`; }).join('')}</tbody>
  </table>
</div>
<div class="card" style="display:flex;justify-content:flex-end">
  <button class="btn-small" onclick="exportCSV()">Export CSV ↓</button>
</div>`;
}

function exportCSV() {
  const rows = [['Room','Current dB','Status','Alerts'], ...ROOMS.map(r=>[r.name,Math.round(r.db),r.status,ALERTS.filter(a=>a.room===r.name).length])];
  const csv  = rows.map(r=>r.join(',')).join('\n');
  const a    = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent(csv);
  a.download = 'noise_report.csv';
  a.click();
  toast('CSV exported');
}

function renderConfig(el, canEdit) {
  el.innerHTML = `
<div class="grid-2">
  <div class="card">
    <div class="card-title">Decibel thresholds</div>
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;font-weight:500">Warning threshold</span><span style="font-size:13px;font-family:var(--mono)" id="wt">${CONFIG.warnThreshold} dB</span></div>
      <input type="range" min="40" max="100" value="${CONFIG.warnThreshold}" style="width:100%;accent-color:var(--amber)" ${!canEdit?'disabled':''} oninput="CONFIG.warnThreshold=+this.value;document.getElementById('wt').textContent=this.value+' dB'">
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;font-weight:500">Critical threshold</span><span style="font-size:13px;font-family:var(--mono)" id="ct">${CONFIG.critThreshold} dB</span></div>
      <input type="range" min="50" max="120" value="${CONFIG.critThreshold}" style="width:100%;accent-color:var(--red)" ${!canEdit?'disabled':''} oninput="CONFIG.critThreshold=+this.value;document.getElementById('ct').textContent=this.value+' dB'">
    </div>
  </div>
  <div class="card">
    <div class="card-title">Notification methods</div>
    <div class="setting-row"><div class="setting-info"><h4>Visual Alerts</h4><p>On-screen indicators</p></div><label class="toggle"><input type="checkbox" ${CONFIG.visualAlerts?'checked':''} ${!canEdit?'disabled':''} onchange="CONFIG.visualAlerts=this.checked"><span class="slider-toggle"></span></label></div>
    <div class="setting-row"><div class="setting-info"><h4>Email Notifications</h4><p>Alert emails to recipients</p></div><label class="toggle"><input type="checkbox" ${CONFIG.emailAlerts?'checked':''} ${!canEdit?'disabled':''} onchange="CONFIG.emailAlerts=this.checked"><span class="slider-toggle"></span></label></div>
    <div class="setting-row"><div class="setting-info"><h4>Sound Alerts</h4><p>Audio on critical events</p></div><label class="toggle"><input type="checkbox" ${CONFIG.soundAlerts?'checked':''} ${!canEdit?'disabled':''} onchange="CONFIG.soundAlerts=this.checked"><span class="slider-toggle"></span></label></div>
  </div>
  <div class="card">
    <div class="card-title">Active rooms</div>
    ${ROOMS.map(r=>`<div class="setting-row"><div class="setting-info"><h4>${r.name}</h4></div><label class="toggle"><input type="checkbox" checked ${!canEdit?'disabled':''}><span class="slider-toggle"></span></label></div>`).join('')}
  </div>
  <div class="card">
    <div class="card-title">Email settings</div>
    <div class="mb16"><div class="field-label">Recipient email</div><input class="field" value="${CONFIG.recipient}" ${!canEdit?'disabled':''} onchange="CONFIG.recipient=this.value"></div>
    <div><div class="field-label">Quiet period notes</div><textarea class="field" rows="3" placeholder="e.g. exclude during fire drills…" ${!canEdit?'disabled':''}></textarea></div>
  </div>
</div>
${canEdit ? `<div style="display:flex;justify-content:flex-end"><button class="btn-small" onclick="saveConfig()">Save Configuration</button></div>` : '<p style="color:var(--muted);font-size:13px">View only — manager or admin can edit.</p>'}`;
}

function saveConfig() {
  LOGS.unshift({user:currentUser.name, action:'Updated alert configuration', ip:'127.0.0.1', time:fmt()});
  saveState();
  toast('Configuration saved');
}

function renderAccount(el) {
  const u = currentUser;
  el.innerHTML = `
<div class="grid-2">
  <div class="card">
    <div class="card-title">Profile</div>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
      <div class="avatar">${initials(u.name)}</div>
      <div><div style="font-size:16px;font-weight:600">${u.name}</div><div style="font-size:13px;color:var(--muted)">${u.email}</div><div style="margin-top:6px"><span class="pill ${u.role==='admin'?'critical':u.role==='manager'?'warning':'normal'}">${u.role}</span></div></div>
    </div>
    <div class="mb16"><div class="field-label">Full name</div><input class="field" id="acc-name" value="${u.name}"></div>
    <div class="mb24"><div class="field-label">Email address</div><input class="field" id="acc-email" value="${u.email}"></div>
    <button class="btn-small" onclick="saveProfile()">Save changes</button>
  </div>
  <div class="card">
    <div class="card-title">Change password</div>
    <div class="mb16"><div class="field-label">Current password</div><input class="field" id="acc-curr" type="password" placeholder="••••••••"></div>
    <div class="mb16"><div class="field-label">New password</div><input class="field" id="acc-new" type="password" placeholder="••••••••"></div>
    <div class="mb24"><div class="field-label">Confirm new password</div><input class="field" id="acc-conf" type="password" placeholder="••••••••"></div>
    <button class="btn-small" onclick="savePassword()">Update password</button>
  </div>
</div>`;
}

function saveProfile() {
  const name  = document.getElementById('acc-name').value.trim();
  const email = document.getElementById('acc-email').value.trim();
  if (!name || !email) { toast('Fields cannot be empty'); return; }
  currentUser.name  = name;
  currentUser.email = email;
  document.getElementById('sb-name').textContent = name;
  LOGS.unshift({user:name, action:'Updated profile', ip:'127.0.0.1', time:fmt()});
  saveState();
  toast('Profile saved');
}

function savePassword() {
  const curr = document.getElementById('acc-curr').value;
  const nw   = document.getElementById('acc-new').value;
  const conf = document.getElementById('acc-conf').value;
  if (curr !== currentUser.password) { toast('Current password is wrong'); return; }
  if (nw.length < 6)                 { toast('Password must be at least 6 characters'); return; }
  if (nw !== conf)                   { toast('Passwords do not match'); return; }
  currentUser.password = nw;
  LOGS.unshift({user:currentUser.name, action:'Changed password', ip:'127.0.0.1', time:fmt()});
  saveState();
  toast('Password updated');
}

function startClock() {
  setInterval(() => {
    const el = document.getElementById('topbar-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }, 1000);
}

function doLogout() {
  if (mapInst)   { mapInst.remove(); mapInst = null; }
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  LOGS.unshift({user:currentUser.name, action:'Logged out', ip:'127.0.0.1', time:fmt()});
  currentUser = null;
  saveState();
  window.location.href = 'index.html';
}
