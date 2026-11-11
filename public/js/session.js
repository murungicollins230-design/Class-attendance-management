/**
 * Session register page.
 * - Shows every enrolled student with present / absent / late radios.
 * - Lecturer (course owner) or admin can edit and save the register.
 * - Registrar gets a read-only view.
 */

let session = null;
let canManage = false;

(function init() {
  const user = requireLogin();
  if (!user) return;
  renderNavbar();

  const id = qsParam('id');
  if (!id || !/^\d+$/.test(id)) {
    document.getElementById('content').innerHTML = '<p class="empty">Invalid session id.</p>';
    return;
  }
  loadRegister(user, id);
})();

async function loadRegister(user, id) {
  try {
    session = await api.get(`/api/sessions/${id}`);
    canManage = user.role === 'admin' || (user.role === 'lecturer' && Number(session.lecturer_id) === Number(user.id));

    document.getElementById('session-title').textContent = session.topic;
    document.getElementById('session-sub').innerHTML =
      `<b>${escapeHtml(session.course_code)}</b> · ${fmtDate(session.session_date)} · ` +
      `${fmtTime(session.start_time)}${session.end_time ? '–' + fmtTime(session.end_time) : ''} · ` +
      `${escapeHtml(session.room || 'room TBA')} · lecturer: ${escapeHtml(session.lecturer_name)}`;
    document.getElementById('back-link').href = `/course.html?id=${session.course_id}`;

    if (!['admin', 'lecturer', 'registrar'].includes(user.role)) {
      document.getElementById('content').innerHTML =
        '<p class="empty">Registers are only visible to lecturers, registrar staff and administrators.</p>';
      return;
    }

    const data = await api.get(`/api/sessions/${id}/register`);

    document.getElementById('content').innerHTML = `
      <div class="register-controls">
        <div class="chips" id="summary-chips"></div>
        <div>
          ${canManage
            ? '<button class="gold" id="save-register">💾 Save register</button>'
            : '<span class="inline-note">Read-only view (registrar)</span>'}
        </div>
      </div>

      ${canManage ? '<p class="hint" style="margin:0 0 10px;">Select present, absent or late for each student, add an optional note, then save. Students without a selection stay unrecorded.</p>' : ''}

      <div class="card table-wrap">
        <table class="list" id="register-table">
          <thead>
            <tr>
              <th>Student</th><th>Student number</th><th style="text-align:center">Present</th><th style="text-align:center">Absent</th><th style="text-align:center">Late</th><th>Note</th>
            </tr>
          </thead>
          <tbody id="register-body"></tbody>
        </table>
      </div>`;

    renderRegister(data.register);

    if (canManage) {
      document.getElementById('save-register').addEventListener('click', saveRegister);
    }
    updateChips();
  } catch (err) { handleError(err); }
}

function renderRegister(register) {
  const body = document.getElementById('register-body');
  if (!register.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No students are enrolled in this course yet.</td></tr>';
    return;
  }
  body.innerHTML = register.map((row) => `
    <tr data-student="${row.student_id}">
      <td><b>${escapeHtml(row.student_name)}</b></td>
      <td>${escapeHtml(row.student_number)}</td>
      <td style="text-align:center"><input type="radio" name="st-${row.student_id}" value="present" ${row.status === 'present' ? 'checked' : ''} ${canManage ? '' : 'disabled'} /></td>
      <td style="text-align:center"><input type="radio" name="st-${row.student_id}" value="absent"  ${row.status === 'absent' ? 'checked' : ''} ${canManage ? '' : 'disabled'} /></td>
      <td style="text-align:center"><input type="radio" name="st-${row.student_id}" value="late"    ${row.status === 'late' ? 'checked' : ''} ${canManage ? '' : 'disabled'} /></td>
      <td><input class="note-input" data-student="${row.student_id}" value="${escapeHtml(row.note || '')}" placeholder="optional note" ${canManage ? '' : 'disabled'} /></td>
    </tr>`).join('');

  document.querySelectorAll('#register-table input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', updateChips);
  });
}

function currentSelections() {
  const rows = [...document.querySelectorAll('#register-body tr[data-student]')];
  return rows.map((tr) => {
    const studentId = Number(tr.dataset.student);
    const checked = tr.querySelector('input[type="radio"]:checked');
    const note = tr.querySelector('.note-input').value.trim();
    return { student_id: studentId, status: checked ? checked.value : null, note: note || undefined };
  });
}

function updateChips() {
  const selections = currentSelections();
  const counts = { present: 0, absent: 0, late: 0, unrecorded: 0 };
  for (const s of selections) {
    if (s.status) counts[s.status] += 1; else counts.unrecorded += 1;
  }
  const total = selections.length;
  const attended = counts.present + counts.late;
  const rate = total ? Math.round((attended / total) * 100) : null;

  document.getElementById('summary-chips').innerHTML = `
    <span class="chip"><b>${counts.present}</b> present</span>
    <span class="chip"><b>${counts.late}</b> late</span>
    <span class="chip"><b>${counts.absent}</b> absent</span>
    <span class="chip"><b>${counts.unrecorded}</b> unrecorded</span>
    <span class="chip">attendance <b>${rate === null ? '—' : rate + '%'}</b></span>`;
}

async function saveRegister() {
  const selections = currentSelections();
  const entries = selections.filter((s) => s.status !== null);

  if (!entries.length) {
    toast('Select at least one attendance status before saving.', 'error');
    return;
  }

  try {
    const result = await api.put(`/api/sessions/${session.id}/register`, { entries });
    toast(`Register saved: ${result.saved} attendance entries recorded.`, 'success');
  } catch (err) { handleError(err); }
}
