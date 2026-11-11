/**
 * Summary / reporting routes.
 *   GET /api/summaries/overview             -> platform totals          (admin, registrar)
 *   GET /api/summaries/courses/:courseId    -> per-student statistics   (staff)
 *   GET /api/summaries/sessions/:sessionId  -> session statistics       (staff)
 *   GET /api/summaries/students/:studentId  -> per-course statistics    (self or staff)
 *
 * "Attended" is counted as present + late, so the attendance rate is the
 * percentage of recorded entries where the student attended the session.
 */
const router = require('express').Router();
const pool = require('../db');
const { ApiError, ok, asyncHandler } = require('../utils/respond');
const { requireAuth, requireRole, studentCanOnlyAccessSelf } = require('../middleware/auth');
const { paramInt } = require('../middleware/validate');
const { getCourseOr404, getSessionOr404 } = require('../utils/access');

router.get('/overview', requireAuth, requireRole('admin', 'registrar'), asyncHandler(async (req, res) => {
  const [[totals]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users)                                  AS users_total,
       (SELECT COUNT(*) FROM users WHERE role = 'student')           AS students_total,
       (SELECT COUNT(*) FROM users WHERE role = 'lecturer')          AS lecturers_total,
       (SELECT COUNT(*) FROM courses)                                AS courses_total,
       (SELECT COUNT(*) FROM enrolments)                             AS enrolments_total,
       (SELECT COUNT(*) FROM class_sessions)                         AS sessions_total,
       (SELECT COUNT(*) FROM attendance)                             AS attendance_total,
       (SELECT COUNT(*) FROM attendance WHERE status = 'present')     AS present_total,
       (SELECT COUNT(*) FROM attendance WHERE status = 'absent')      AS absent_total,
       (SELECT COUNT(*) FROM attendance WHERE status = 'late')        AS late_total`
  );

  const [courses] = await pool.query(
    `SELECT c.id, c.code, c.title, u.full_name AS lecturer_name,
            (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = c.id)  AS student_count,
            (SELECT COUNT(*) FROM class_sessions s WHERE s.course_id = c.id) AS session_count,
            (SELECT COUNT(*) FROM attendance a JOIN class_sessions s2 ON s2.id = a.session_id
               WHERE s2.course_id = c.id)                                AS recorded_count,
            (SELECT COUNT(*) FROM attendance a JOIN class_sessions s2 ON s2.id = a.session_id
               WHERE s2.course_id = c.id AND a.status IN ('present','late')) AS attended_count
       FROM courses c
       JOIN users u ON u.id = c.lecturer_id
      ORDER BY c.code`
  );

  const attended = Number(totals.present_total) + Number(totals.late_total);
  ok(res, {
    totals: {
      ...totals,
      attendance_rate: Number(totals.attendance_total) > 0
        ? Math.round((attended / Number(totals.attendance_total)) * 1000) / 10
        : null,
    },
    courses: courses.map((c) => ({
      ...c,
      attendance_rate: Number(c.recorded_count) > 0
        ? Math.round((Number(c.attended_count) / Number(c.recorded_count)) * 1000) / 10
        : null,
    })),
  }, 'Platform overview.');
}));

router.get('/courses/:courseId', requireAuth, requireRole('admin', 'registrar', 'lecturer'), asyncHandler(async (req, res) => {
  const courseId = paramInt(req, 'courseId');
  const course = await getCourseOr404(courseId);

  const [stats] = await pool.query(
    `SELECT u.id AS student_id, u.full_name, u.student_number,
            COUNT(a.id)                                          AS recorded,
            COALESCE(SUM(a.status = 'present'), 0)              AS present,
            COALESCE(SUM(a.status = 'absent'), 0)               AS absent,
            COALESCE(SUM(a.status = 'late'), 0)                  AS late
       FROM enrolments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN attendance a
             ON a.student_id = u.id
            AND a.session_id IN (SELECT id FROM class_sessions WHERE course_id = ?)
      WHERE e.course_id = ?
      GROUP BY u.id, u.full_name, u.student_number
      ORDER BY u.full_name`,
    [courseId, courseId]
  );

  const [sessionStats] = await pool.query(
    `SELECT COUNT(*) AS sessions_held,
            COALESCE(SUM(recorded_count), 0) AS entries_recorded
       FROM (
         SELECT s.id,
                (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS recorded_count
         FROM class_sessions s WHERE s.course_id = ?
       ) AS per_session`,
    [courseId]
  );

  const rows = stats.map((r) => ({
    ...r,
    attendance_rate: Number(r.recorded) > 0
      ? Math.round(((Number(r.present) + Number(r.late)) / Number(r.recorded)) * 1000) / 10
      : null,
  }));
  const recordedTotal = rows.reduce((sum, r) => sum + Number(r.recorded), 0);
  const attendedTotal = rows.reduce((sum, r) => sum + Number(r.present) + Number(r.late), 0);

  ok(res, {
    course: { id: course.id, code: course.code, title: course.title, lecturer_name: course.lecturer_name },
    course_summary: {
      students: rows.length,
      sessions_held: Number(sessionStats[0].sessions_held),
      entries_recorded: recordedTotal,
      attendance_rate: recordedTotal > 0 ? Math.round((attendedTotal / recordedTotal) * 1000) / 10 : null,
    },
    students: rows,
  }, `Attendance summary for ${course.code}.`);
}));

router.get('/sessions/:sessionId', requireAuth, requireRole('admin', 'registrar', 'lecturer'), asyncHandler(async (req, res) => {
  const session = await getSessionOr404(paramInt(req, 'sessionId'));

  const [summary] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM enrolments e WHERE e.course_id = ?) AS enrolled,
       COALESCE(SUM(a.status = 'present'), 0)                    AS present,
       COALESCE(SUM(a.status = 'absent'), 0)                     AS absent,
       COALESCE(SUM(a.status = 'late'), 0)                        AS late
     FROM class_sessions s
     LEFT JOIN attendance a ON a.session_id = s.id
     WHERE s.id = ?`,
    [session.course_id, session.id]
  );

  const s = summary[0];
  const recorded = Number(s.present) + Number(s.absent) + Number(s.late);
  const enrolled = Number(s.enrolled);
  ok(res, {
    session: {
      id: session.id, topic: session.topic, session_date: session.session_date,
      course_code: session.course_code, course_title: session.course_title,
    },
    summary: {
      enrolled,
      recorded,
      unrecorded: enrolled - recorded,
      present: Number(s.present),
      absent: Number(s.absent),
      late: Number(s.late),
      attendance_rate: enrolled > 0 ? Math.round(((Number(s.present) + Number(s.late)) / enrolled) * 1000) / 10 : null,
    },
  }, `Summary for session "${session.topic}".`);
}));

router.get('/students/:studentId', requireAuth, asyncHandler(async (req, res) => {
  const studentId = paramInt(req, 'studentId');
  studentCanOnlyAccessSelf(req, studentId);

  const [students] = await pool.query(
    "SELECT id, full_name, student_number FROM users WHERE id = ? AND role = 'student'",
    [studentId]
  );
  if (!students.length) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', `No student with id ${studentId} was found.`);
  }

  const [rows] = await pool.query(
    `SELECT c.id AS course_id, c.code, c.title,
            COUNT(s.id)                              AS sessions_held,
            COUNT(a.id)                              AS recorded,
            COALESCE(SUM(a.status = 'present'), 0)   AS present,
            COALESCE(SUM(a.status = 'absent'), 0)    AS absent,
            COALESCE(SUM(a.status = 'late'), 0)      AS late
       FROM enrolments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN class_sessions s ON s.course_id = c.id
       LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = ?
      WHERE e.student_id = ?
      GROUP BY c.id, c.code, c.title
      ORDER BY c.code`,
    [studentId, studentId]
  );

  const courses = rows.map((r) => ({
    ...r,
    attendance_rate: Number(r.recorded) > 0
      ? Math.round(((Number(r.present) + Number(r.late)) / Number(r.recorded)) * 1000) / 10
      : null,
  }));
  const recorded = courses.reduce((sum, c) => sum + Number(c.recorded), 0);
  const attended = courses.reduce((sum, c) => sum + Number(c.present) + Number(c.late), 0);

  ok(res, {
    student: students[0],
    overall: {
      courses: courses.length,
      recorded,
      attendance_rate: recorded > 0 ? Math.round((attended / recorded) * 1000) / 10 : null,
    },
    courses,
  }, `Attendance breakdown for ${students[0].full_name}.`);
}));

module.exports = router;
