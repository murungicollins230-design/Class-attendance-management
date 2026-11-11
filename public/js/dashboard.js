/** Dashboard page — different content per role. */

let user = null;

(function init() {
  user = requireLogin();
  if (!user) return;
  renderNavbar();

  if (user.role === 'lecturer') return lecturerDashboard();
  if (user.role === 'student') return studentDashboard();
  if (user.role === 'registrar') return registrarDashboard();
  return adminDashboard();
})();

/* ------------------------------------------------------------- lecturer -- */

async function lecturerDashboard() {
  document.getElementById('page-sub').textContent = 'Your courses, sessions and attendance registers.';
  const content = document.getElementById('content');

  try {
    const courses = await api.get('/api/courses');
    if (!courses.length) {
      content.innerHTML = '<p class="empty">You have no courses assigned yet.</p>';
      return;
    }
    content.innerHTML = '<div class="grid cols-3">' + courses.map((c) => `
      <div class="card course-card">
        <span class="code">${escapeHtml(c.code)}</span>
        <div class="title">${escapeHtml(c.title)}</div>
        <div class="meta">${escapeHtml(c.study_year)} · ${escapeHtml(c.semester)}</div>
        <div class="meta">
          ${c.student_count} students · ${c.session_count} sessions ·
          ${c.attendance_rate === null ? 'no attendance yet' : 'attendance ' + c.attendance_rate + '%'}
        </div>
        ${rateProgress(c.attendance_rate)}
        <a class="btn" href="/course.html?id=${c.id}">Open course</a>
      </div>`).join('') + '</div>';
  } catch (err) { handleError(err); }
}

/* -------------------------------------------------------------- student -- */

async function studentDashboard() {
  document.getElementById('page-sub').textContent = 'Your attendance across enrolled courses.';
  const content = document.getElementById('content');

  try {
    const [summary, history] = await Promise.all([
      api.get(`/api/summaries/students/${user.id}`),
      api.get(`/api/students/${user.id}/attendance`),
    ]);

    const cards = summary.courses.map((c) => `
      <div class="card course-card">
        <span class="code">${escapeHtml(c.code)}</span>
        <div class="title">${escapeHtml(c.title)}</div>
        <div class="meta">${c.recorded} of ${c.sessions_held} sessions recorded ·
          present ${c.present} · late ${c.late} · absent ${c.absent}</div>
        ${rateProgress(c.attendance_rate)}
        <div>${rateBadge(c.attendance_rate)} overall attendance</div>
        <a class="btn" href="/student.html?id=${user.id}">View my history</a>
      </div>`).join('');

    const recent = history.records.slice(0, 8).map((r) => `
      <tr>
        <td>${escapeHtml(r.course_code)}</td>
        <td>${escapeHtml(r.topic)}</td>
        <td>${fmtDate(r.session_date)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        Overall attendance rate: <b>${summary.overall.attendance_rate === null ? 'no records yet' : summary.overall.attendance_rate + '%'}</b>
        across ${summary.overall.courses} course(s) and ${summary.overall.recorded} recorded session(s).
      </div>
      <div class="grid cols-3">${cards || '<p class="empty">You are not enrolled in any course yet.</p>'}</div>
      <div class="section">
        <h2>Recent attendance</h2>
        <div class="card table-wrap">
          <table class="list">
            <thead><tr><th>Course</th><th>Topic</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>${recent || '<tr><td colspan="4" class="empty">No attendance recorded yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { handleError(err); }
}

/* ------------------------------------------------------------- registrar -- */

async function registrarDashboard() {
  document.getElementById('page-sub').textContent = 'Read-only review of courses and attendance statistics.';
  const content = document.getElementById('content');
  await loadOverview('registrar');
}

/* ---------------------------------------------------------------- admin -- */

async function adminDashboard() {
  document.getElementById('page-sub').textContent = 'System administration: courses, accounts and statistics.';
  await loadOverview('admin');
}

async function loadOverview(role) {
  const content = document.getElementById('content');

  try {
    const overview = await api.get('/api/summaries/overview');
    const t = overview.totals;

    content.innerHTML = `
      <div class="grid cols-4">
        <div class="card stat-card"><div class="value">${t.users_total}</div><div class="label">User accounts</div></div>
        <div class="card stat-card"><div class="value">${t.courses_total}</div><div class="label">Courses</div></div>
        <div class="card stat-card"><div class="value">${t.sessions_total}</div><div class="label">Class sessions</div></div>
        <div class="card stat-card"><div class="value">${t.attendance_rate === null ? '—' : t.attendance_rate + '%'}</div><div class="label">Overall attendance</div></div>
      </div>

      <div class="section">
        <h2>Courses</h2>
        <div class="card table-wrap">
          <table class="list">
            <thead><tr><th>Code</th><th>Title</th><th>Lecturer</th><th>Students</th><th>Sessions</th><th>Attendance</th><th></th></tr></thead>
            <tbody>
              ${overview.courses.map((c) => `
                <tr>
                  <td><b>${escapeHtml(c.code)}</b></td>
                  <td>${escapeHtml(c.title)}</td>
                  <td>${escapeHtml(c.lecturer_name)}</td>
                  <td>${c.student_count}</td>
                  <td>${c.session_count}</td>
                  <td>${rateBadge(c.attendance_rate)}</td>
                  <td><a class="btn ghost" href="/course.html?id=${c.id}">Open</a></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section" id="admin-tools"></div>`;

    if (role === 'admin') renderAdminTools();
  } catch (err) { handleError(err); }
}

function renderAdminTools() {
  const host = document.getElementById('admin-tools');

  host.innerHTML = `
    <h2>Create a course</h2>
    <div class="card">
      <p class="hint">Creates a new demonstration course taught by a lecturer.</p>
      <form class="panel" id="course-form">
        <div class="field"><label for="c-code">Code</label><input id="c-code" required maxlength="20" placeholder="SWE2107" /></div>
        <div class="field"><label for="c-title">Title</label><input id="c-title" required maxlength="160" placeholder="Software Quality Assurance" /></div>
        <div class="field"><label for="c-lecturer">Lecturer</label><select id="c-lecturer" required></select></div>
        <div class="field"><label for="c-year">Year</label><input id="c-year" value="Year 2" /></div>
        <div class="field"><label for="c-sem">Semester</label><input id="c-sem" value="Semester 1" /></div>
        <button type="submit">Create course</button>
      </form>
    </div>

    <h2 style="margin-top:24px;">Create a user account</h2>
    <div class="card">
      <p class="hint">Adds a lecturer, student, registrar or administrator account.</p>
      <form class="panel" id="user-form">
        <div class="field"><label for="u-name">Full name</label><input id="u-name" required maxlength="120" placeholder="FULL NAME" /></div>
        <div class="field"><label for="u-email">Email</label><input id="u-email" type="email" required placeholder="name@must.ac.ug" /></div>
        <div class="field"><label for="u-pass">Password</label><input id="u-pass" required minlength="6" placeholder="min 6 characters" /></div>
        <div class="field"><label for="u-role">Role</label>
          <select id="u-role" required>
            <option value="student">Student</option>
            <option value="lecturer">Lecturer</option>
            <option value="registrar">Registrar</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <div class="field"><label for="u-num">Student number</label><input id="u-num" placeholder="required for students, e.g. 2025/BSE/250/PS" /></div>
        <button type="submit">Create account</button>
      </form>
    </div>`;

  // lecturer options for the course form
  api.get('/api/users').then((users) => {
    const lecturers = users.filter((u) => u.role === 'lecturer');
    document.getElementById('c-lecturer').innerHTML =
      lecturers.map((l) => `<option value="${l.id}">${escapeHtml(l.full_name)}</option>`).join('');
  }).catch(handleError);

  document.getElementById('course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/courses', {
        code: document.getElementById('c-code').value.trim(),
        title: document.getElementById('c-title').value.trim(),
        lecturer_id: Number(document.getElementById('c-lecturer').value),
        study_year: document.getElementById('c-year').value.trim() || 'Year 2',
        semester: document.getElementById('c-sem').value.trim() || 'Semester 1',
      });
      toast('Course created successfully.', 'success');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) { handleError(err); }
  });

  document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/users', {
        full_name: document.getElementById('u-name').value.trim(),
        email: document.getElementById('u-email').value.trim(),
        password: document.getElementById('u-pass').value,
        role: document.getElementById('u-role').value,
        student_number: document.getElementById('u-num').value.trim() || undefined,
      });
      toast('Account created successfully.', 'success');
      document.getElementById('user-form').reset();
    } catch (err) { handleError(err); }
  });
}
