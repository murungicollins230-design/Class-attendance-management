/** Course page: sessions, enrolled students and the attendance summary. */

let course = null;
let canManage = false;
const isStaff = (user) => ['admin', 'lecturer', 'registrar'].includes(user.role);

(function init() {
  const user = requireLogin();
  if (!user) return;
  renderNavbar();

  const id = qsParam('id');
  if (!id || !/^\d+$/.test(id)) {
    document.getElementById('content').innerHTML = '<p class="empty">Invalid course id.</p>';
    return;
  }
  loadCourse(user, id);
})();

async function loadCourse(user, id) {
  try {
    course = await api.get(`/api/courses/${id}`);
    canManage = user.role === 'admin' || (user.role === 'lecturer' && Number(course.lecturer_id) === Number(user.id));

    document.getElementById('course-title').textContent = `${course.code} — ${course.title}`;
    document.getElementById('course-sub').innerHTML =
      `${escapeHtml(course.lecturer_name)} · ${escapeHtml(course.study_year)} · ${escapeHtml(course.semester)} · ` +
      `${course.student_count} students · ${course.session_count} sessions`;

    const sections = [];

    // ---------------------------------------------------------- sessions --
    sections.push(`
      <div class="section">
        <h2>Class sessions</h2>
        <p class="hint">Each session has its own attendance register.</p>
        <div class="card table-wrap">
          <table class="list" id="sessions-table">
            <thead><tr><th>Date</th><th>Time</th><th>Room</th><th>Topic</th><th>Register</th><th></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        ${canManage ? `
        <div class="card" style="margin-top:12px;">
          <h3>Create a class session</h3>
          <form class="panel" id="session-form">
            <div class="field"><label for="s-topic">Topic</label><input id="s-topic" required maxlength="200" placeholder="e.g. Express middleware" /></div>
            <div class="field"><label for="s-date">Date</label><input id="s-date" type="date" required /></div>
            <div class="field"><label for="s-start">Starts</label><input id="s-start" type="time" required value="09:00" /></div>
            <div class="field"><label for="s-end">Ends</label><input id="s-end" type="time" value="11:00" /></div>
            <div class="field"><label for="s-room">Room</label><input id="s-room" maxlength="60" placeholder="LH3" /></div>
            <button type="submit">Create session</button>
          </form>
        </div>` : ''}
      </div>`);

    // -------------------------------------------------------- enrolments --
    if (isStaff(user)) {
      sections.push(`
        <div class="section">
          <h2>Enrolled students</h2>
          <div class="card table-wrap">
            <table class="list" id="students-table">
              <thead><tr><th>Student</th><th>Student number</th><th>Email</th><th>Attendance</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          ${canManage ? `
          <div class="card" style="margin-top:12px;">
            <h3>Enrol a student</h3>
            <form class="panel" id="enrol-form">
              <div class="field"><label for="e-student">Student</label><select id="e-student" required></select></div>
              <button type="submit">Enrol student</button>
            </form>
          </div>` : ''}
        </div>`);
    }

    // ----------------------------------------------------------- summary --
    if (isStaff(user)) {
      sections.push(`
        <div class="section">
          <h2>Attendance summary</h2>
          <p class="hint">Attended = present + late. The rate is attended ÷ recorded entries.</p>
          <div class="card table-wrap">
            <table class="list" id="summary-table">
              <thead><tr><th>Student</th><th>Number</th><th>Present</th><th>Late</th><th>Absent</th><th>Rate</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>`);
    }

    document.getElementById('content').innerHTML = sections.join('');
    // loadStudents() also fills the attendance-summary table
    await Promise.all([loadSessions(), isStaff(user) ? loadStudents() : Promise.resolve()]);

    if (canManage) {
      document.getElementById('session-form').addEventListener('submit', onCreateSession);
      const enrolForm = document.getElementById('enrol-form');
      if (enrolForm) enrolForm.addEventListener('submit', onEnrol);
    }
  } catch (err) { handleError(err); }
}

async function loadSessions() {
  const sessions = await api.get(`/api/courses/${course.id}/sessions`);
  const body = document.querySelector('#sessions-table tbody');
  if (!sessions.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No sessions created yet.</td></tr>';
    return;
  }
  body.innerHTML = sessions.map((s) => `
    <tr>
      <td>${fmtDate(s.session_date)}</td>
      <td>${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</td>
      <td>${escapeHtml(s.room || '—')}</td>
      <td>${escapeHtml(s.topic)}</td>
      <td>${s.recorded_count}/${s.student_count} recorded ${s.unrecorded_count > 0 ? '<span class="badge unrecorded">' + s.unrecorded_count + ' missing</span>' : ''}</td>
      <td class="actions-cell"><a class="btn" href="/session.html?id=${s.id}">${canManage ? 'Open register' : 'View register'}</a></td>
    </tr>`).join('');
}

async function loadStudents() {
  const [students, summary] = await Promise.all([
    api.get(`/api/courses/${course.id}/students`),
    api.get(`/api/summaries/courses/${course.id}`),
  ]);
  const rates = {};
  for (const row of summary.students) rates[row.student_id] = row.attendance_rate;

  const body = document.querySelector('#students-table tbody');
  if (!students.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No students enrolled yet.</td></tr>';
  } else {
    body.innerHTML = students.map((s) => `
      <tr>
        <td><b>${escapeHtml(s.full_name)}</b></td>
        <td>${escapeHtml(s.student_number)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td>${rateBadge(rates[s.id])}</td>
        <td class="actions-cell">
          <a class="btn ghost" href="/student.html?id=${s.id}">History</a>
          ${canManage ? `<button class="danger" data-unenrol="${s.id}">Remove</button>` : ''}
        </td>
      </tr>`).join('');
    document.querySelectorAll('[data-unenrol]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.del(`/api/courses/${course.id}/enrolments/${btn.dataset.unenrol}`);
          toast('Student removed from the course.', 'success');
          loadStudents();
        } catch (err) { handleError(err); }
      });
    });
  }

  const sumBody = document.querySelector('#summary-table tbody');
  sumBody.innerHTML = summary.students.map((row) => `
    <tr>
      <td><b>${escapeHtml(row.full_name)}</b></td>
      <td>${escapeHtml(row.student_number)}</td>
      <td>${row.present}</td>
      <td>${row.late}</td>
      <td>${row.absent}</td>
      <td>${rateBadge(row.attendance_rate)}</td>
      <td class="actions-cell"><a class="btn ghost" href="/student.html?id=${row.student_id}">History</a></td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty">No students enrolled.</td></tr>';

  if (canManage) {
    const select = document.getElementById('e-student');
    if (select) {
      const available = await api.get(`/api/students?not_enrolled_in=${course.id}`);
      select.innerHTML = available.length
        ? available.map((s) => `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.student_number)})</option>`).join('')
        : '<option value="">— all students are already enrolled —</option>';
    }
  }
}

async function onCreateSession(event) {
  event.preventDefault();
  try {
    await api.post(`/api/courses/${course.id}/sessions`, {
      topic: document.getElementById('s-topic').value.trim(),
      session_date: document.getElementById('s-date').value,
      start_time: document.getElementById('s-start').value,
      end_time: document.getElementById('s-end').value,
      room: document.getElementById('s-room').value.trim(),
    });
    toast('Session created successfully.', 'success');
    loadSessions();
  } catch (err) { handleError(err); }
}

async function onEnrol(event) {
  event.preventDefault();
  const studentId = document.getElementById('e-student').value;
  if (!studentId) return toast('There are no students left to enrol.', 'error');
  try {
    await api.post(`/api/courses/${course.id}/enrolments`, { student_id: Number(studentId) });
    toast('Student enrolled successfully.', 'success');
    loadStudents();
  } catch (err) { handleError(err); }
}
