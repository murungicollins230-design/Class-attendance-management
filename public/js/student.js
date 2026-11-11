/**
 * Student attendance history page.
 * Students see their own history; staff can view any student's history.
 */

(function init() {
  const user = requireLogin();
  if (!user) return;
  renderNavbar();

  const id = qsParam('id') || user.id;
  if (!/^\d+$/.test(id)) {
    document.getElementById('content').innerHTML = '<p class="empty">Invalid student id.</p>';
    return;
  }
  loadHistory(id);
})();

async function loadHistory(studentId) {
  try {
    const [profile, summary, history] = await Promise.all([
      api.get(`/api/students/${studentId}`),
      api.get(`/api/summaries/students/${studentId}`),
      api.get(`/api/students/${studentId}/attendance`),
    ]);

    document.getElementById('student-title').textContent = profile.full_name;
    document.getElementById('student-sub').innerHTML =
      `${escapeHtml(profile.student_number || '')} · ${escapeHtml(profile.email)} · ` +
      `${summary.overall.recorded} recorded session(s) · overall attendance ` +
      (summary.overall.attendance_rate === null ? 'not available yet' : `<b>${summary.overall.attendance_rate}%</b>`);

    const cards = summary.courses.map((c) => `
      <div class="card course-card">
        <span class="code">${escapeHtml(c.code)}</span>
        <div class="title">${escapeHtml(c.title)}</div>
        <div class="meta">${c.recorded} of ${c.sessions_held} sessions recorded · present ${c.present} · late ${c.late} · absent ${c.absent}</div>
        ${rateProgress(c.attendance_rate)}
        <div>${rateBadge(c.attendance_rate)}</div>
      </div>`).join('');

    const rows = history.records.map((r) => `
      <tr>
        <td><b>${escapeHtml(r.course_code)}</b></td>
        <td>${escapeHtml(r.topic)}</td>
        <td>${fmtDate(r.session_date)}</td>
        <td>${fmtTime(r.start_time)}</td>
        <td>${escapeHtml(r.room || '—')}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${escapeHtml(r.note || '')}</td>
      </tr>`).join('');

    document.getElementById('content').innerHTML = `
      <div class="grid cols-3">${cards || '<p class="empty">Not enrolled in any course.</p>'}</div>
      <div class="section">
        <h2>Attendance history</h2>
        <div class="card table-wrap">
          <table class="list">
            <thead><tr><th>Course</th><th>Topic</th><th>Date</th><th>Time</th><th>Room</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" class="empty">No attendance records yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
  } catch (err) { handleError(err); }
}
