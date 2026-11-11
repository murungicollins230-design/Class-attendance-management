/**
 * Course, enrolment and class-session routes.
 *
 *   GET    /api/courses                        -> courses visible to the caller
 *   POST   /api/courses                        -> create a course           (admin)
 *   GET    /api/courses/:courseId              -> course details
 *   DELETE /api/courses/:courseId              -> delete a course           (admin)
 *   GET    /api/courses/:courseId/students     -> enrolled students         (staff)
 *   POST   /api/courses/:courseId/enrolments   -> enrol a student   (admin / course lecturer)
 *   DELETE /api/courses/:courseId/enrolments/:studentId -> un-enrol  (admin / course lecturer)
 *   GET    /api/courses/:courseId/sessions     -> class sessions for the course
 *   POST   /api/courses/:courseId/sessions     -> create a session (admin / course lecturer)
 */
const router = require('express').Router();
const pool = require('../db');
const { ApiError, ok, asyncHandler } = require('../utils/respond');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requireFields, paramInt } = require('../middleware/validate');
const {
  getCourseOr404,
  assertCanViewCourse,
  assertCanManageCourse,
} = require('../utils/access');

const COURSE_SELECT = `
  SELECT c.id, c.code, c.title, c.study_year, c.semester, c.lecturer_id,
         u.full_name AS lecturer_name,
         (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = c.id) AS student_count,
         (SELECT COUNT(*) FROM class_sessions s WHERE s.course_id = c.id) AS session_count,
         (SELECT COUNT(*) FROM attendance a JOIN class_sessions s2 ON s2.id = a.session_id
            WHERE s2.course_id = c.id) AS recorded_count,
         (SELECT COUNT(*) FROM attendance a JOIN class_sessions s2 ON s2.id = a.session_id
            WHERE s2.course_id = c.id AND a.status = 'present') AS present_count,
         (SELECT COUNT(*) FROM attendance a JOIN class_sessions s2 ON s2.id = a.session_id
            WHERE s2.course_id = c.id AND a.status = 'late') AS late_count
    FROM courses c
    JOIN users u ON u.id = c.lecturer_id`;

/** Add an attendance rate to each course row. Attended = present + late. */
function decorate(rows) {
  return rows.map((r) => ({
    ...r,
    attendance_rate: Number(r.recorded_count) > 0
      ? Math.round(((Number(r.present_count) + Number(r.late_count)) / Number(r.recorded_count)) * 1000) / 10
      : null,
  }));
}

// ---------------------------------------------------------------- courses ---

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { role, id } = req.user;
  let rows;

  if (role === 'admin' || role === 'registrar') {
    [rows] = await pool.query(`${COURSE_SELECT} ORDER BY c.code`);
  } else if (role === 'lecturer') {
    [rows] = await pool.query(`${COURSE_SELECT} WHERE c.lecturer_id = ? ORDER BY c.code`, [id]);
  } else {
    [rows] = await pool.query(
      `${COURSE_SELECT}
        JOIN enrolments e ON e.course_id = c.id AND e.student_id = ?
       ORDER BY c.code`,
      [id]
    );
  }
  ok(res, decorate(rows), `${rows.length} course(s) available.`);
}));

router.post('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  requireFields(req.body, {
    code: { type: 'string', maxLength: 20 },
    title: { type: 'string', maxLength: 160 },
    lecturer_id: { type: 'int' },
    study_year: { type: 'string', maxLength: 20, required: false },
    semester: { type: 'string', maxLength: 30, required: false },
  });

  const code = String(req.body.code).trim().toUpperCase();
  const [dup] = await pool.query('SELECT id FROM courses WHERE code = ?', [code]);
  if (dup.length) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `A course with code ${code} already exists.`);
  }

  const [lecturer] = await pool.query(
    "SELECT id, full_name FROM users WHERE id = ? AND role = 'lecturer'",
    [req.body.lecturer_id]
  );
  if (!lecturer.length) {
    throw new ApiError(404, 'LECTURER_NOT_FOUND', `No lecturer with id ${req.body.lecturer_id} was found.`);
  }

  const [result] = await pool.query(
    `INSERT INTO courses (code, title, study_year, semester, lecturer_id)
     VALUES (?, ?, ?, ?, ?)`,
    [code, String(req.body.title).trim(), req.body.study_year || 'Year 2', req.body.semester || 'Semester 1', req.body.lecturer_id]
  );

  const course = await getCourseOr404(result.insertId);
  ok(res, { ...course, student_count: 0, session_count: 0, recorded_count: 0, present_count: 0, late_count: 0, attendance_rate: null }, `Course ${code} created successfully.`, 201);
}));

router.get('/:courseId', requireAuth, asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  const course = await getCourseOr404(courseId);
  await assertCanViewCourse(req, course);
  const [rows] = await pool.query(`${COURSE_SELECT} WHERE c.id = ?`, [courseId]);
  ok(res, decorate(rows)[0], 'Course details.');
}));

router.delete('/:courseId', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  const course = await getCourseOr404(courseId);
  await pool.query('DELETE FROM courses WHERE id = ?', [courseId]);
  ok(res, null, `Course ${course.code} and all its sessions, enrolments and attendance records were deleted.`);
}));

// ------------------------------------------------------------- enrolments ---

router.get('/:courseId/students', requireAuth, requireRole('admin', 'registrar', 'lecturer'), asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  await getCourseOr404(courseId);
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.student_number, e.enrolled_at
       FROM enrolments e
       JOIN users u ON u.id = e.student_id
      WHERE e.course_id = ?
      ORDER BY u.full_name`,
    [courseId]
  );
  ok(res, rows, `${rows.length} student(s) enrolled.`);
}));

router.post('/:courseId/enrolments', requireAuth, asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  const course = await getCourseOr404(courseId);
  assertCanManageCourse(req, course);

  requireFields(req.body, { student_id: { type: 'int' } });
  const studentId = Number(req.body.student_id);

  const [students] = await pool.query(
    "SELECT id, full_name, student_number FROM users WHERE id = ? AND role = 'student'",
    [studentId]
  );
  if (!students.length) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', `No student with id ${studentId} was found.`);
  }

  const [dup] = await pool.query(
    'SELECT id FROM enrolments WHERE course_id = ? AND student_id = ?',
    [courseId, studentId]
  );
  if (dup.length) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `${students[0].full_name} is already enrolled in ${course.code}.`);
  }

  await pool.query('INSERT INTO enrolments (course_id, student_id) VALUES (?, ?)', [courseId, studentId]);
  ok(res, { course_id: Number(courseId), student: students[0] }, `${students[0].full_name} enrolled in ${course.code}.`, 201);
}));

router.delete('/:courseId/enrolments/:studentId', requireAuth, asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  const studentId = paramInt(req, 'studentId');
  const course = await getCourseOr404(courseId);
  assertCanManageCourse(req, course);

  const [enrolment] = await pool.query(
    'SELECT e.id, u.full_name FROM enrolments e JOIN users u ON u.id = e.student_id WHERE e.course_id = ? AND e.student_id = ?',
    [courseId, studentId]
  );
  if (!enrolment.length) {
    throw new ApiError(404, 'ENROLMENT_NOT_FOUND', 'This student is not enrolled in the course.');
  }

  await pool.query('DELETE FROM enrolments WHERE course_id = ? AND student_id = ?', [courseId, studentId]);
  ok(res, null, `${enrolment[0].full_name} removed from ${course.code}.`);
}));

// --------------------------------------------------------------- sessions ---

router.get('/:courseId/sessions', requireAuth, asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  const course = await getCourseOr404(courseId);
  await assertCanViewCourse(req, course);

  const [rows] = await pool.query(
    `SELECT s.id, s.course_id, s.topic, s.session_date, s.start_time, s.end_time, s.room,
            s.created_at,
            (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = s.course_id) AS student_count,
            (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS recorded_count
       FROM class_sessions s
      WHERE s.course_id = ?
      ORDER BY s.session_date DESC, s.start_time DESC, s.id DESC`,
    [courseId]
  );
  ok(res, rows.map((r) => ({ ...r, unrecorded_count: Number(r.student_count) - Number(r.recorded_count) })), `${rows.length} session(s) for ${course.code}.`);
}));

router.post('/:courseId/sessions', requireAuth, asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  const course = await getCourseOr404(courseId);
  assertCanManageCourse(req, course);

  requireFields(req.body, {
    topic: { type: 'string', maxLength: 200 },
    session_date: { type: 'date' },
    start_time: { type: 'time' },
    end_time: { type: 'time', required: false },
    room: { type: 'string', maxLength: 60, required: false },
  });

  const { topic, session_date, start_time, end_time, room } = req.body;
  if (end_time && String(end_time).slice(0, 5) <= String(start_time).slice(0, 5)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'end_time must be later than start_time.');
  }

  const [result] = await pool.query(
    `INSERT INTO class_sessions (course_id, topic, session_date, start_time, end_time, room, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [courseId, String(topic).trim(), session_date, start_time, end_time || null, room || null, req.user.id]
  );

  const [created] = await pool.query('SELECT * FROM class_sessions WHERE id = ?', [result.insertId]);
  ok(res, { ...created[0], course_code: course.code }, `Session "${topic}" created for ${course.code}.`, 201);
}));

module.exports = router;
