// ============================================================
//  NoiseSense – user.js  (MySQL edition)
// ============================================================

const TITLES = { live:'Live Monitor', alerts:'My Alerts', account:'Account Settings' };

async function init() {
  if (!currentUser || currentUser.role !== 'user') {
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
    if (ap.id.replace('panel-','') === 'live') refreshLive();
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
    case 'alerts':  renderAlerts(el, false);  break;
    case 'account': renderAccount(el);        break;
  }
}

init();
