/**
 * Student routes.
 *   GET /api/students                  -> directory of students (staff only)
 *   GET /api/students/:studentId       -> profile + enrolled courses
 *   GET /api/students/:studentId/attendance -> attendance history
 *
 * Students can only ever see their OWN records; staff can see anyone's.
 */
const router = require('express').Router();
const pool = require('../db');
const { ApiError, ok, asyncHandler } = require('../utils/respond');
const { requireAuth, requireRole, studentCanOnlyAccessSelf } = require('../middleware/auth');
const { paramInt } = require('../middleware/validate');

router.get('/', requireAuth, requireRole('admin', 'registrar', 'lecturer'), asyncHandler(async (req, res) => {
  // Optional filters used by the enrolment form in the frontend:
  //   ?course_id=1          -> students enrolled in course 1
  //   ?not_enrolled_in=1    -> students NOT enrolled in course 1
  const inCourse = req.query.course_id && /^\d+$/.test(req.query.course_id);
  const notInCourse = req.query.not_enrolled_in && /^\d+$/.test(req.query.not_enrolled_in);

  const [students] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.student_number,
            (SELECT COUNT(*) FROM enrolments e2 WHERE e2.student_id = u.id) AS course_count
       FROM users u
      WHERE u.role = 'student'
        ${req.query.course_id && /^\d+$/.test(req.query.course_id)
          ? 'AND u.id IN (SELECT student_id FROM enrolments WHERE course_id = ?)'
          : ''}
        ${req.query.not_enrolled_in && /^\d+$/.test(req.query.not_enrolled_in)
          ? 'AND u.id NOT IN (SELECT student_id FROM enrolments WHERE course_id = ?)'
          : ''}
      ORDER BY u.full_name`,
    [
      ...(req.query.course_id && /^\d+$/.test(req.query.course_id) ? [Number(req.query.course_id)] : []),
      ...(req.query.not_enrolled_in && /^\d+$/.test(req.query.not_enrolled_in) ? [Number(req.query.not_enrolled_in)] : []),
    ]
  );
  ok(res, students, `${students.length} student(s) found.`);
}));

router.get('/:studentId', requireAuth, asyncHandler(async (req, res) => {
  const studentId = paramInt(req, 'studentId');
  studentCanOnlyAccessSelf(req, studentId);

  const [students] = await pool.query(
    "SELECT id, full_name, email, role, student_number, created_at FROM users WHERE id = ? AND role = 'student'",
    [studentId]
  );
  if (!students.length) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', `No student with id ${studentId} was found.`);
  }

  const [courses] = await pool.query(
    `SELECT c.id, c.code, c.title, c.study_year, c.semester, u.full_name AS lecturer_name
       FROM enrolments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = c.lecturer_id
      WHERE e.student_id = ?
      ORDER BY c.code`,
    [studentId]
  );
  ok(res, { ...students[0], courses }, 'Student profile.');
}));

router.get('/:studentId/attendance', requireAuth, asyncHandler(async (req, res) => {
  const studentId = paramInt(req, 'studentId');
  studentCanOnlyAccessSelf(req, studentId);

  const [students] = await pool.query(
    'SELECT id, full_name, student_number FROM users WHERE id = ?',
    [studentId]
  );
  if (!students.length) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', `No student with id ${studentId} was found.`);
  }

  const params = [studentId];
  let courseFilter = '';
  if (req.query.course_id && /^\d+$/.test(req.query.course_id)) {
    courseFilter = 'AND s.course_id = ?';
    params.push(Number(req.query.course_id));
  }

  const [rows] = await pool.query(
    `SELECT a.id, a.status, a.note, a.recorded_at, a.updated_at,
            s.id AS session_id, s.topic, s.session_date, s.start_time, s.room,
            c.id AS course_id, c.code AS course_code, c.title AS course_title
       FROM attendance a
       JOIN class_sessions s ON s.id = a.session_id
       JOIN courses c ON c.id = s.course_id
      WHERE a.student_id = ?
        ${courseFilter}
      ORDER BY s.session_date DESC, s.start_time DESC`,
    params
  );

  const total = rows.length;
  const present = rows.filter((r) => r.status === 'present').length;
  const late = rows.filter((r) => r.status === 'late').length;
  const absent = rows.filter((r) => r.status === 'absent').length;

  ok(res, {
    student: students[0],
    summary: {
      total, present, absent, late,
      attendance_rate: total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : null,
    },
    records: rows,
  }, `${total} attendance record(s) for ${students[0].full_name}.`);
}));

module.exports = router;
