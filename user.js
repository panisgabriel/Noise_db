// ========== USER DASHBOARD ==========
// Panels: Live Monitor, My Alerts, Account

const TITLES = {
  live:'Live Monitor', alerts:'My Alerts', account:'Account Settings',
};

function init() {
  if (!currentUser || currentUser.role !== 'user') {
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
    if (pid === 'live') refreshLive();
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
    case 'live':    renderLive(el);           break;
    case 'alerts':  renderAlerts(el, false);  break; // read-only, no resolve btn
    case 'account': renderAccount(el);        break;
  }
}

// ========== BOOT ==========
init();
