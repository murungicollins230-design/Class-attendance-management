/**
 * Shared data-access helpers used by the course, session and summary routes.
 * Keeps permission rules in one place:
 *   - admin          -> can do everything
 *   - registrar      -> read-only access to all courses
 *   - lecturer       -> can manage (create sessions / record attendance) only
 *                       in courses they teach, but can view any course
 *   - student        -> can only view courses they are enrolled in
 */
const pool = require('../db');
const { ApiError } = require('./respond');

async function findCourse(courseId) {
  const [rows] = await pool.query(
    `SELECT c.*, u.full_name AS lecturer_name
       FROM courses c
       JOIN users u ON u.id = c.lecturer_id
      WHERE c.id = ?`,
    [courseId]
  );
  return rows[0] || null;
}

async function findSession(sessionId) {
  const [rows] = await pool.query(
    `SELECT s.*,
            c.code AS course_code, c.title AS course_title,
            c.study_year, c.semester, c.lecturer_id, u.full_name AS lecturer_name
       FROM class_sessions s
       JOIN courses c  ON c.id = s.course_id
       JOIN users   u  ON u.id = c.lecturer_id
      WHERE s.id = ?`,
    [sessionId]
  );
  return rows[0] || null;
}

async function isStudentEnrolled(studentId, courseId) {
  const [rows] = await pool.query(
    'SELECT id FROM enrolments WHERE student_id = ? AND course_id = ?',
    [studentId, courseId]
  );
  return rows.length > 0;
}

/** Throw 404 when the course does not exist. */
async function getCourseOr404(courseId) {
  const course = await findCourse(courseId);
  if (!course) {
    throw new ApiError(404, 'COURSE_NOT_FOUND', `No course with id ${courseId} was found.`);
  }
  return course;
}

/** Throw 404 when the session does not exist. */
async function getSessionOr404(sessionId) {
  const session = await findSession(sessionId);
  if (!session) {
    throw new ApiError(404, 'SESSION_NOT_FOUND', `No class session with id ${sessionId} was found.`);
  }
  return session;
}

/**
 * Viewing a course: staff can view any course; students only courses they
 * are enrolled in.
 */
async function assertCanViewCourse(req, course) {
  const { role, id } = req.user;
  if (role === 'admin' || role === 'registrar' || role === 'lecturer') return;
  if (role === 'student') {
    if (await isStudentEnrolled(id, course.id)) return;
    throw new ApiError(403, 'FORBIDDEN', 'You are not enrolled in this course.');
  }
  throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this course.');
}

/**
 * Managing a course (create sessions, enrol students, record attendance):
 * only the administrator or the lecturer who teaches the course.
 */
function assertCanManageCourse(req, course) {
  const { role, id } = req.user;
  if (role === 'admin') return;
  if (role === 'lecturer' && Number(id) === Number(course.lecturer_id)) return;
  throw new ApiError(
    403,
    'FORBIDDEN',
    role === 'lecturer'
      ? 'You can only record attendance and create sessions for courses you teach.'
      : 'Only the course lecturer or an administrator can perform this action.'
  );
}

module.exports = {
  findCourse,
  findSession,
  isStudentEnrolled,
  getCourseOr404,
  getSessionOr404,
  assertCanViewCourse,
  assertCanManageCourse,
};
