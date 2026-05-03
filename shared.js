// ============================================================
//  NoiseSense – shared.js  (MySQL edition)
//  All state is now fetched from / persisted to the PHP API.
// ============================================================

const API = 'api';

// ── Auth ──────────────────────────────────────────────────────
let currentUser = (() => {
  try { return JSON.parse(sessionStorage.getItem('ns_user')); } catch { return null; }
})();

function authHeaders() {
  const token = sessionStorage.getItem('ns_token') ?? '';
  return { 'Content-Type': 'application/json', 'X-NS-Token': token };
}

async function apiFetch(path, opts = {}) {
  opts.credentials = 'include';
  opts.headers = { ...authHeaders(), ...(opts.headers ?? {}) };
  const res = await fetch(`${API}/${path}`, opts);
  if (res.status === 401) { window.location.href = 'index.html'; return null; }
  return res.json();
}

// ── In-memory runtime state (refreshed from API) ──────────────
let ROOMS   = [];
let ALERTS  = [];
let CONFIG  = { warnThreshold: 65, critThreshold: 80 };

async function loadRooms()  { const d = await apiFetch('rooms.php');  if (d?.ok)  ROOMS  = d.rooms;  }
async function loadAlerts() { const d = await apiFetch('alerts.php'); if (d?.ok)  ALERTS = d.alerts; }
async function loadConfig() {
  const d = await apiFetch('config.php');
  if (d?.ok) {
    CONFIG = {
      warnThreshold:  d.config.warn_threshold,
      critThreshold:  d.config.crit_threshold,
      emailAlerts:    !!d.config.email_alerts,
      soundAlerts:    !!d.config.sound_alerts,
      visualAlerts:   !!d.config.visual_alerts,
      recipient:      d.config.alert_recipient,
    };
  }
}

// ── Utils ─────────────────────────────────────────────────────
function fmt()  { return new Date().toLocaleString(); }
function ts()   { return new Date().toLocaleTimeString(); }
function sev(db) {
  if (db >= CONFIG.critThreshold) return { label: 'Critical', cls: 'critical' };
  if (db >= CONFIG.warnThreshold) return { label: 'Warning',  cls: 'warning'  };
  return { label: 'Normal', cls: 'normal' };
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}
function initials(n) { return n.split(' ').map(w => w[0]).join('').toUpperCase(); }

// ── Chart / Map state ─────────────────────────────────────────
let chartInst    = null;
let chartData    = [52,58,55,63,60,48,54,61,57,52,65,50];
let mapInst      = null;
let mapMarkers   = [];
let selectedRoom = 0;

// ── Simulation tick (still client-side; swap for real sensor feed) ──
function startSim(onTick) {
  setInterval(async () => {
    // Simulate dB readings and POST them to the DB
    for (const r of ROOMS) {
      r.db = Math.max(30, Math.min(105, (parseFloat(r.db) || 50) + (Math.random() * 10 - 5)));
      const s = sev(r.db);
      if (s.label !== r.status) {
        r.status = s.label;
        // Persist reading to MySQL
        apiFetch('readings.php', {
          method: 'POST',
          body: JSON.stringify({ room_id: r.id, db_level: Math.round(r.db) }),
        });
      }
    }

    // Refresh alerts from DB every tick
    await loadAlerts();

    // Alert badge
    const crit  = ALERTS.filter(a => !a.resolved && a.severity === 'Critical').length;
    const badge = document.getElementById('alert-badge');
    if (badge) {
      badge.style.display = crit > 0 ? 'inline' : 'none';
      if (crit > 0) badge.textContent = crit;
    }

    // Chart
    chartData.push(Math.round(ROOMS[selectedRoom]?.db ?? 50));
    if (chartData.length > 14) chartData.shift();
    if (chartInst) { chartInst.data.datasets[0].data = [...chartData]; chartInst.update('none'); }

    // Map markers
    if (mapInst && mapMarkers.length) {
      mapMarkers.forEach((m, i) => {
        const r = ROOMS[i]; if (!r) return;
        const s   = sev(r.db);
        const col = s.cls === 'critical' ? '#ef5356' : s.cls === 'warning' ? '#f59e0b' : '#22d3a0';
        m.setIcon(L.divIcon({ html: `<div style="width:14px;height:14px;border-radius:50%;background:${col};border:2px solid #fff;box-shadow:0 0 0 4px ${col}44"></div>`, iconSize: [14,14], iconAnchor: [7,7] }));
        m.bindPopup(`<b>${r.name}</b><br>${Math.round(r.db)} dB — ${s.label}`);
      });
    }

    if (onTick) onTick();
  }, 2500);
}

// ── Panel renderers (unchanged from original) ─────────────────
function renderLive(el) {
  const r   = ROOMS[selectedRoom] ?? { name: '—', db: 0 };
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
  const r   = ROOMS[selectedRoom] ?? {};
  const db  = Math.round(r.db ?? 0);
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
      <td><span class="pill ${(a.severity||'').toLowerCase()}">${a.severity}</span></td>
      <td style="color:var(--muted)">${a.time ?? a.created_at ?? '—'}</td>
      <td>${(a.resolved||a.is_resolved)?'<span style="color:var(--green);font-size:12px">Resolved</span>':'<span style="color:var(--muted);font-size:12px">Open</span>'}</td>
      ${canAct?`<td>${!(a.resolved||a.is_resolved)&&a.db!=='—'?`<button class="action-btn" onclick="resolveAlert(${a.id??i})">Resolve</button>`:'—'}</td>`:''}`
    ).join('')}</tbody>
  </table>
</div>`;
}

async function resolveAlert(id) {
  const data = await apiFetch('alerts.php', {
    method: 'PUT',
    body: JSON.stringify({ id }),
  });
  if (!data?.ok) { toast(data?.error ?? 'Failed to resolve'); return; }
  await loadAlerts();
  const el = document.getElementById('panel-alerts');
  if (el) renderAlerts(el, ['admin','manager'].includes(currentUser?.role));
  toast('Alert resolved');
}

function renderReports(el) {
  const avgDb = ROOMS.length ? Math.round(ROOMS.reduce((s,r) => s + parseFloat(r.db||0), 0) / ROOMS.length) : 0;
  el.innerHTML = `
<div class="grid-3">
  <div class="card" style="margin-bottom:0"><div class="card-title">Avg dB today</div><div class="stat-val">${avgDb}<span style="font-size:16px;color:var(--muted)"> dB</span></div></div>
  <div class="card" style="margin-bottom:0"><div class="card-title">Total alerts</div><div class="stat-val">${ALERTS.length}</div></div>
  <div class="card" style="margin-bottom:0"><div class="card-title">Rooms monitored</div><div class="stat-val">${ROOMS.length}</div></div>
</div>
<div class="card">
  <div class="card-title">Per-room summary</div>
  <table class="data-table">
    <thead><tr><th>Room</th><th>Current dB</th><th>Status</th><th>Alerts</th></tr></thead>
    <tbody>${ROOMS.map(r => { const s = sev(r.db); return `<tr>
      <td style="font-weight:500">${r.name}</td>
      <td style="font-family:var(--mono)">${Math.round(r.db)}</td>
      <td><span class="pill ${s.cls}">${s.label}</span></td>
      <td>${ALERTS.filter(a => a.room === r.name).length}</td>
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
  a.href     = 'data:text/csv,' + encodeURIComponent(csv);
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
  </div>
</div>
${canEdit ? `<div style="display:flex;justify-content:flex-end"><button class="btn-small" onclick="saveConfig()">Save Configuration</button></div>` : '<p style="color:var(--muted);font-size:13px">View only — manager or admin can edit.</p>'}`;
}

async function saveConfig() {
  const data = await apiFetch('config.php', {
    method: 'PUT',
    body: JSON.stringify({
      warn_threshold:  CONFIG.warnThreshold,
      crit_threshold:  CONFIG.critThreshold,
      email_alerts:    CONFIG.emailAlerts ? 1 : 0,
      sound_alerts:    CONFIG.soundAlerts ? 1 : 0,
      visual_alerts:   CONFIG.visualAlerts ? 1 : 0,
      alert_recipient: CONFIG.recipient,
    }),
  });
  if (data?.ok) toast('Configuration saved');
  else toast(data?.error ?? 'Failed to save');
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

async function saveProfile() {
  const name  = document.getElementById('acc-name').value.trim();
  const email = document.getElementById('acc-email').value.trim();
  if (!name || !email) { toast('Fields cannot be empty'); return; }

  const data = await apiFetch('users.php', {
    method: 'PUT',
    body: JSON.stringify({ id: currentUser.id, name, email }),
  });
  if (!data?.ok) { toast(data?.error ?? 'Failed to save'); return; }

  currentUser.name  = name;
  currentUser.email = email;
  sessionStorage.setItem('ns_user', JSON.stringify(currentUser));
  document.getElementById('sb-name').textContent = name;
  toast('Profile saved');
}

async function savePassword() {
  const curr = document.getElementById('acc-curr').value;
  const nw   = document.getElementById('acc-new').value;
  const conf = document.getElementById('acc-conf').value;
  if (nw.length < 6)  { toast('Password must be at least 6 characters'); return; }
  if (nw !== conf)     { toast('Passwords do not match'); return; }

  const data = await apiFetch('users.php', {
    method: 'PUT',
    body: JSON.stringify({ id: currentUser.id, current_password: curr, password: nw }),
  });
  if (!data?.ok) { toast(data?.error ?? 'Failed to update'); return; }
  toast('Password updated');
}

function startClock() {
  setInterval(() => {
    const el = document.getElementById('topbar-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
  }, 1000);
}

async function doLogout() {
  if (mapInst)   { mapInst.remove(); mapInst = null; }
  if (chartInst) { chartInst.destroy(); chartInst = null; }
  await apiFetch('logout.php', { method: 'POST' });
  sessionStorage.removeItem('ns_user');
  sessionStorage.removeItem('ns_token');
  window.location.href = 'index.html';
}
