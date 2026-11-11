/**
 * Session register and attendance routes — the heart of the workflow.
 *
 *   GET    /api/sessions/:sessionId                      -> session details
 *   GET    /api/sessions/:sessionId/register              -> full register   (staff)
 *   PUT    /api/sessions/:sessionId/register              -> save the whole register
 *                                                          (admin / course lecturer)
 *   POST   /api/sessions/:sessionId/attendance             -> record one entry
 *   PUT    /api/sessions/:sessionId/attendance/:studentId  -> update one entry
 *   DELETE /api/sessions/:sessionId/attendance/:studentId  -> remove one entry
 *
 * Validation performed before anything is saved:
 *   - the session must exist (404)
 *   - the student must exist and be enrolled in the course (404 / 400)
 *   - the status must be present | absent | late (400)
 *   - a student may not have two entries for one session (409)
 */
const router = require('express').Router();
const pool = require('../db');
const { ApiError, ok, asyncHandler } = require('../utils/respond');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireFields, requireValidStatus, paramInt } = require('../middleware/validate');
const { getSessionOr404, assertCanManageCourse, isStudentEnrolled } = require('../utils/access');

// ----------------------------------------------------------- session info ---

router.get('/:sessionId', requireAuth, asyncHandler(async (req, res) => {
  const session = await getSessionOr404(paramInt(req, 'sessionId'));

  // students may only view sessions of courses they are enrolled in
  if (req.user.role === 'student' && !(await isStudentEnrolled(req.user.id, session.course_id))) {
    throw new ApiError(403, 'FORBIDDEN', 'You are not enrolled in the course this session belongs to.');
  }

  const [rows] = await pool.query(
    `SELECT s.*, (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = s.course_id) AS student_count,
            (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS recorded_count,
            (SELECT lecturer_id FROM courses WHERE id = s.course_id) AS lecturer_id
       FROM class_sessions s WHERE s.id = ?`,
    [session.id]
  );
  ok(res, { ...rows[0], course_code: session.course_code, course_title: session.course_title, lecturer_name: session.lecturer_name }, 'Session details.');
}));

// ---------------------------------------------------------------- register ---

router.get('/:sessionId/register', requireAuth, requireRole('admin', 'registrar', 'lecturer'), asyncHandler(async (req, res) => {
  const session = await getSessionOr404(paramInt(req, 'sessionId'));

  const [register] = await pool.query(
    `SELECT u.id AS student_id, u.full_name AS student_name, u.student_number,
            a.id AS attendance_id, a.status, a.note, a.recorded_at, a.updated_at,
            r.full_name AS recorded_by_name
       FROM enrolments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN attendance a ON a.session_id = ? AND a.student_id = u.id
       LEFT JOIN users r ON r.id = a.recorded_by
      WHERE e.course_id = ?
      ORDER BY u.full_name`,
    [session.id, session.course_id]
  );

  const summary = buildSummary(register);
  ok(res, { session, register, summary }, `Register for "${session.topic}" (${session.course_code}).`);
}));

/**
 * Save the whole register at once (used by the frontend "Save register" button).
 * Body: { "entries": [{ "student_id": 5, "status": "present", "note": "" }, ...] }
 * All entries are validated first; if any entry is invalid NOTHING is saved.
 */
router.put('/:sessionId/register', requireAuth, asyncHandler(async (req, res) => {
  const session = await getSessionOr404(paramInt(req, 'sessionId'));
  assertCanManageCourse(req, session);

  requireFields(req.body, { entries: { type: 'array' } });
  const entries = req.body.entries;

  if (!entries.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', '"entries" must contain at least one attendance entry.');
  }

  const seen = new Set();
  for (const entry of entries) {
    requireFields(entry, {
      student_id: { type: 'int' },
      status: { type: 'string' },
      note: { type: 'string', maxLength: 200, required: false },
    });
    requireValidStatus(entry.status);

    const studentId = Number(entry.student_id);
    if (seen.has(studentId)) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Duplicate entry in request: student ${studentId} appears more than once.`);
    }
    seen.add(studentId);

    if (!(await isStudentEnrolled(studentId, session.course_id))) {
      throw new ApiError(400, 'NOT_ENROLLED', `Student ${studentId} is not enrolled in ${session.course_code}, so attendance cannot be recorded.`);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const entry of entries) {
      const [existing] = await conn.query(
        'SELECT id FROM attendance WHERE session_id = ? AND student_id = ?',
        [session.id, Number(entry.student_id)]
      );
      if (existing.length) {
        await conn.query('UPDATE attendance SET status = ?, note = ? WHERE id = ?', [
          entry.status,
          entry.note || null,
          existing[0].id,
        ]);
      } else {
        await conn.query(
          `INSERT INTO attendance (session_id, student_id, status, note, recorded_by)
           VALUES (?, ?, ?, ?, ?)`,
          [session.id, Number(entry.student_id), entry.status, entry.note || null, req.user.id]
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [register] = await pool.query(
    `SELECT u.id AS student_id, a.status, a.note
       FROM enrolments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN attendance a ON a.session_id = ? AND a.student_id = u.id
      WHERE e.course_id = ?`,
    [session.id, session.course_id]
  );
  ok(res, { saved: entries.length, summary: buildSummary(register) }, `Register saved: ${entries.length} attendance entries recorded for "${session.topic}".`);
}));

// -------------------------------------------------------- single entries ---

router.post('/:sessionId/attendance', requireAuth, asyncHandler(async (req, res) => {
  const session = await getSessionOr404(paramInt(req, 'sessionId'));
  assertCanManageCourse(req, session);

  requireFields(req.body, {
    student_id: { type: 'int' },
    status: { type: 'string' },
    note: { type: 'string', maxLength: 200, required: false },
  });
  const studentId = Number(req.body.student_id);
  requireValidStatus(req.body.status);

  const [students] = await pool.query(
    "SELECT id, full_name, student_number FROM users WHERE id = ? AND role = 'student'",
    [studentId]
  );
  if (!students.length) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', `No student with id ${studentId} was found.`);
  }
  if (!(await isStudentEnrolled(studentId, session.course_id))) {
    throw new ApiError(400, 'NOT_ENROLLED', `${students[0].full_name} is not enrolled in ${session.course_code}, so attendance cannot be recorded.`);
  }

  const [dup] = await pool.query('SELECT id FROM attendance WHERE session_id = ? AND student_id = ?', [session.id, studentId]);
  if (dup.length) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `${students[0].full_name} already has an attendance record for "${session.topic}". Use the update endpoint to change it.`);
  }

  const [result] = await pool.query(
    `INSERT INTO attendance (session_id, student_id, status, note, recorded_by)
     VALUES (?, ?, ?, ?, ?)`,
    [session.id, studentId, req.body.status, req.body.note || null, req.user.id]
  );
  const [created] = await pool.query('SELECT * FROM attendance WHERE id = ?', [result.insertId]);
  ok(res, { ...created[0], student_name: students[0].full_name, student_number: students[0].student_number, course_code: session.course_code }, `Attendance recorded: ${students[0].full_name} marked ${req.body.status} for "${session.topic}".`, 201);
}));

router.put('/:sessionId/attendance/:studentId', requireAuth, asyncHandler(async (req, res) => {
  const session = await getSessionOr404(paramInt(req, 'sessionId'));
  assertCanManageCourse(req, session);
  const studentId = paramInt(req, 'studentId');

  requireFields(req.body, {
    status: { type: 'string' },
    note: { type: 'string', maxLength: 200, required: false },
  });
  requireValidStatus(req.body.status);

  const [existing] = await pool.query(
    'SELECT a.*, u.full_name AS student_name FROM attendance a JOIN users u ON u.id = a.student_id WHERE a.session_id = ? AND a.student_id = ?',
    [session.id, studentId]
  );
  if (!existing.length) {
    throw new ApiError(404, 'ATTENDANCE_NOT_FOUND', `No attendance record exists for student ${studentId} in "${session.topic}". Use POST to create one.`);
  }

  await pool.query('UPDATE attendance SET status = ?, note = ? WHERE id = ?', [
    req.body.status,
    req.body.note !== undefined ? req.body.note : existing[0].note,
    existing[0].id,
  ]);
  const [updated] = await pool.query('SELECT * FROM attendance WHERE id = ?', [existing[0].id]);
  ok(res, { ...updated[0], student_name: existing[0].student_name, course_code: session.course_code }, `Attendance updated: ${existing[0].student_name} is now marked ${req.body.status}.`);
}));

router.delete('/:sessionId/attendance/:studentId', requireAuth, asyncHandler(async (req, res) => {
  const session = await getSessionOr404(paramInt(req, 'sessionId'));
  assertCanManageCourse(req, session);
  const studentId = paramInt(req, 'studentId');

  const [existing] = await pool.query(
    'SELECT a.*, u.full_name AS student_name FROM attendance a JOIN users u ON u.id = a.student_id WHERE a.session_id = ? AND a.student_id = ?',
    [session.id, studentId]
  );
  if (!existing.length) {
    throw new ApiError(404, 'ATTENDANCE_NOT_FOUND', 'No attendance record exists for this student in this session.');
  }

  await pool.query('DELETE FROM attendance WHERE id = ?', [existing[0].id]);
  ok(res, null, `Attendance record for ${existing[0].student_name} removed from "${session.topic}".`);
}));

// ----------------------------------------------------------------- helpers --

function buildSummary(register) {
  const counts = { present: 0, absent: 0, late: 0, unrecorded: 0 };
  for (const row of register) {
    if (row.status && counts[row.status] !== undefined) counts[row.status] += 1;
    else counts.unrecorded += 1;
  }
  const enrolled = register.length;
  const attended = counts.present + counts.late;
  return {
    enrolled,
    ...counts,
    attendance_rate: enrolled > 0 ? Math.round((attended / enrolled) * 1000) / 10 : null,
  };
}

module.exports = router;
