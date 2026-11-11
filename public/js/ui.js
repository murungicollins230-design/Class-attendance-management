/**
 * Shared UI helpers: session handling, navbar, toasts, formatting.
 */

function getSessionUser() {
  return JSON.parse(sessionStorage.getItem('user') || 'null');
}

/** Redirect to the login page if nobody is signed in. */
function requireLogin() {
  const user = getSessionUser();
  if (!sessionStorage.getItem('token') || !user) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(dateString) {
  if (!dateString) return '';
  const d = new Date(String(dateString).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTime(t) {
  return String(t || '').slice(0, 5);
}

function statusBadge(status) {
  const map = {
    present: 'Present', absent: 'Absent', late: 'Late', unrecorded: 'Not recorded',
  };
  return `<span class="badge ${status || 'unrecorded'}">${map[status] || 'Not recorded'}</span>`;
}

function rateBadge(rate) {
  if (rate === null || rate === undefined) return '<span class="badge rate-none">—</span>';
  const cls = rate >= 75 ? 'rate-good' : rate >= 50 ? 'rate-warn' : 'rate-bad';
  return `<span class="badge ${cls}">${rate}%</span>`;
}

function rateProgress(rate) {
  const cls = rate === null ? '' : rate >= 75 ? 'good' : rate >= 50 ? 'warn' : 'bad';
  return `<div class="progress ${cls}"><span style="width:${Math.max(0, Math.min(100, rate || 0))}%"></span></div>`;
}

function toast(message, type = 'info') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function renderNavbar(active) {
  const user = getSessionUser();
  const el = document.getElementById('navbar');
  if (!el || !user) return;
  el.innerHTML = `
    <a class="brand" href="/dashboard.html">
      <span class="mark">MUST</span>
      <span>Class Attendance <small>· SWE2106 Group G</small></span>
    </a>
    <div class="who">
      <span class="name">${escapeHtml(user.full_name)}</span>
      <span class="role-chip">${escapeHtml(user.role)}</span>
      <button class="ghost" id="nav-logout" style="padding:5px 12px;">Log out</button>
    </div>`;
  document.getElementById('nav-logout').addEventListener('click', async () => {
    try { await api.post('/api/auth/logout'); } catch (_) { /* token may already be gone */ }
    sessionStorage.clear();
    window.location.href = '/index.html';
  });
}

/** Standard error handler for page scripts. */
function handleError(err) {
  console.error(err);
  toast(err.message || 'Something went wrong.', 'error');
}

function qsParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
