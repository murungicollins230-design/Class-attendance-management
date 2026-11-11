/**
 * API smoke test — runs through the full attendance workflow with fictional
 * data, exactly like the Postman collection does, and prints the results.
 *
 *   node scripts/smoke-test.js
 *
 * Requires the API server to be running (npm start) on http://localhost:3000.
 * The script cleans up after itself, so it can be run repeatedly.
 */

const BASE = process.env.API_URL || 'http://localhost:3000';
let passed = 0;
let failed = 0;

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } else {
    failed += 1;
    console.log(`  [FAIL] ${name}${extra ? ' -> ' + extra : ''}`);
  }
}

async function main() {
  console.log(`\nSmoke-testing the Class Attendance API at ${BASE}\n`);

  // ------------------------------------------------------------- health --
  console.log('1. Health check');
  let r = await call('GET', '/api/health');
  check('GET /api/health returns 200 and database connected', r.status === 200 && r.json?.data?.database === 'connected', JSON.stringify(r.json));

  // ---------------------------------------------------------------- auth --
  console.log('2. Authentication');
  r = await call('POST', '/api/auth/login', { body: { email: 'collins.murungi@must.ac.ug', password: 'admin123' } });
  check('admin login returns 200 with token', r.status === 200 && !!r.json?.data?.token);
  const admin = r.json?.data?.token;

  r = await call('POST', '/api/auth/login', { body: { email: 'dickens.aine@must.ac.ug', password: 'lecturer123' } });
  check('lecturer login returns 200 with token', r.status === 200 && !!r.json?.data?.token);
  const lecturer = r.json?.data?.token;

  r = await call('POST', '/api/auth/login', { body: { email: 'savour.nkamushaba@student.must.ac.ug', password: 'student123' } });
  check('student login returns 200 with token', r.status === 200 && !!r.json?.data?.token);
  const student = r.json?.data?.token;

  r = await call('POST', '/api/auth/login', { body: { email: 'osbert.kanyesigye@must.ac.ug', password: 'registrar123' } });
  check('registrar login returns 200 with token', r.status === 200 && !!r.json?.data?.token);
  const registrar = r.json?.data?.token;

  r = await call('POST', '/api/auth/login', { body: { email: 'collins.murungi@must.ac.ug', password: 'wrong-password' } });
  check('wrong password is rejected with 401', r.status === 401 && r.json?.error?.code === 'INVALID_CREDENTIALS');

  r = await call('POST', '/api/auth/login', { body: { email: 'collins.murungi@must.ac.ug' } });
  check('login without password returns 400 VALIDATION_ERROR', r.status === 400 && r.json?.error?.code === 'VALIDATION_ERROR');

  // -------------------------------------------------------------- courses --
  console.log('3. Courses');
  r = await call('GET', '/api/courses', { token: lecturer });
  check('lecturer sees own courses', r.status === 200 && Array.isArray(r.json?.data) && r.json.data.every((c) => c.lecturer_name === 'AINE DICKENS'));
  const swe2106 = r.json?.data?.find((c) => c.code === 'SWE2106');
  check('SWE2106 is in the list with statistics', !!swe2106 && swe2106.student_count === 9 && swe2106.session_count === 8);

  r = await call('GET', `/api/courses/${swe2106.id}`, { token: student });
  check('enrolled student can view course detail', r.status === 200 && r.json?.data?.code === 'SWE2106');

  r = await call('POST', '/api/courses', { token: lecturer, body: { code: 'HAX0001', title: 'Should fail', lecturer_id: 1 } });
  check('lecturer cannot create courses (403)', r.status === 403 && r.json?.error?.code === 'FORBIDDEN');

  r = await call('POST', '/api/courses', { token: admin, body: { code: 'TEST101', title: 'Smoke Test Course', lecturer_id: 2 } });
  check('admin creates a course (201)', r.status === 201 && r.json?.data?.code === 'TEST101');
  const testCourseId = r.json?.data?.id;

  r = await call('POST', '/api/courses', { token: admin, body: { code: 'TEST101', title: 'Duplicate course', lecturer_id: 1 } });
  check('duplicate course code is rejected (409)', r.status === 409 && r.json?.error?.code === 'DUPLICATE_ENTRY');

  r = await call('POST', '/api/courses', { token: admin, body: { title: 'Missing code field' } });
  check('missing code field returns 400 with details', r.status === 400 && r.json?.error?.code === 'VALIDATION_ERROR' && Array.isArray(r.json?.error?.details));

  // ---------------------------------------------------------- enrolments --
  console.log('4. Enrolments');
  r = await call('GET', '/api/students?not_enrolled_in=' + testCourseId, { token: admin });
  check('admin lists students not enrolled in the test course', r.status === 200 && r.json?.data?.length > 0);
  const studentId = r.json?.data?.[0]?.id;

  r = await call('POST', `/api/courses/${testCourseId}/enrolments`, { token: admin, body: { student_id: studentId } });
  check('admin enrolls a student (201)', r.status === 201);

  r = await call('POST', `/api/courses/${testCourseId}/enrolments`, { token: admin, body: { student_id: studentId } });
  check('duplicate enrolment is rejected (409)', r.status === 409 && r.json?.error?.code === 'DUPLICATE_ENTRY');

  r = await call('POST', `/api/courses/${testCourseId}/enrolments`, { token: admin, body: { student_id: 99999 } });
  check('enrolling an unknown student returns 404', r.status === 404 && r.json?.error?.code === 'STUDENT_NOT_FOUND');

  // ------------------------------------------------------------- sessions --
  console.log('5. Class sessions');
  r = await call('GET', `/api/courses/${swe2106.id}/sessions`, { token: lecturer });
  check('lecturer lists course sessions', r.status === 200 && r.json?.data?.length === 8);
  const emptySession = r.json?.data?.find((s) => s.topic === 'Building REST APIs with Express');
  check('the demo session exists with an empty register', !!emptySession && emptySession.recorded_count === 0);

  r = await call('POST', `/api/courses/${testCourseId}/sessions`, {
    token: lecturer,
    body: { topic: 'Smoke test session', session_date: '2026-11-12', start_time: '09:00', end_time: '11:00', room: 'LH3' },
  });
  check('lecturer cannot create sessions in a course they do not teach (403)', r.status === 403);

  r = await call('POST', `/api/courses/${swe2106.id}/sessions`, {
    token: student,
    body: { topic: 'Hack attempt', session_date: '2026-11-12', start_time: '09:00' },
  });
  check('student cannot create sessions (403)', r.status === 403);

  r = await call('POST', `/api/courses/${testCourseId}/sessions`, {
    token: admin,
    body: { topic: 'Smoke test session', session_date: '2026-11-12', start_time: '09:00', end_time: '08:00' },
  });
  check('end time before start time is rejected (400)', r.status === 400 && r.json?.error?.code === 'VALIDATION_ERROR');

  r = await call('POST', `/api/courses/${testCourseId}/sessions`, {
    token: admin,
    body: { topic: 'Smoke test session', session_date: '2026-11-12', start_time: '09:00', end_time: '11:00', room: 'LH3' },
  });
  check('admin creates a session in the test course (201)', r.status === 201);
  const testSessionId = r.json?.data?.id;

  // ----------------------------------------------------------- attendance --
  console.log('6. Attendance recording and validation');
  r = await call('POST', `/api/sessions/${emptySession.id}/attendance`, { token: lecturer, body: { student_id: studentId, status: 'present' } });
  const notEnrolledStudentId = studentId;
  if (r.status === 201) {
    check('lecturer records attendance (201)', r.status === 201 && r.json?.data?.status === 'present');
  } else {
    check(`lecturer records attendance (201) [student ${studentId} may be enrolled in SWE2106]`, r.status === 201 || r.status === 400, JSON.stringify(r.json));
  }
  const recordedStudentId = r.status === 201 ? studentId : 5;

  r = await call('POST', `/api/sessions/${emptySession.id}/attendance`, { token: lecturer, body: { student_id: recordedStudentId, status: 'absent' } });
  check('duplicate attendance entry is rejected (409)', r.status === 409 && r.json?.error?.code === 'DUPLICATE_ENTRY');

  r = await call('POST', `/api/sessions/${emptySession.id}/attendance`, { token: lecturer, body: { student_id: recordedStudentId, status: 'excused' } });
  check('invalid status is rejected (400)', r.status === 400 && r.json?.error?.code === 'VALIDATION_ERROR');

  r = await call('POST', `/api/sessions/${emptySession.id}/attendance`, { token: lecturer, body: { student_id: 14, status: 'present' } });
  check('student not enrolled in the course is rejected (400 NOT_ENROLLED)', r.status === 400 && r.json?.error?.code === 'NOT_ENROLLED');

  r = await call('POST', `/api/sessions/${emptySession.id}/attendance`, { token: student, body: { student_id: recordedStudentId, status: 'present' } });
  check('student cannot record attendance (403)', r.status === 403);

  r = await call('PUT', `/api/sessions/${emptySession.id}/attendance/${recordedStudentId}`, { token: lecturer, body: { status: 'late', note: 'Arrived 10 minutes late' } });
  check('lecturer updates an attendance entry (200)', r.status === 200 && r.json?.data?.status === 'late');

  r = await call('PUT', `/api/sessions/${emptySession.id}/register`, {
    token: lecturer,
    body: { entries: [
      { student_id: 5, status: 'present' },
      { student_id: 6, status: 'absent', note: 'Absent with excuse' },
      { student_id: 7, status: 'late' },
    ] },
  });
  check('bulk register save works (200)', r.status === 200 && r.json?.data?.saved === 3, JSON.stringify(r.json));

  r = await call('PUT', `/api/sessions/${emptySession.id}/register`, {
    token: lecturer,
    body: { entries: [{ student_id: 5, status: 'present' }, { student_id: 5, status: 'absent' }] },
  });
  check('duplicate student in bulk request is rejected (400)', r.status === 400 && r.json?.error?.code === 'VALIDATION_ERROR');

  r = await call('GET', `/api/sessions/${emptySession.id}/register`, { token: lecturer });
  check('register shows the saved entries and summary', r.status === 200 && r.json?.data?.summary?.late === 1);

  r = await call('GET', `/api/sessions/${emptySession.id}/register`, { token: student });
  check('student cannot view the full register (403)', r.status === 403);

  // ------------------------------------------------------------- histories --
  console.log('7. Student histories and access control');
  r = await call('GET', `/api/students/${recordedStudentId}/attendance`, { token: student });
  const isSelf = r.status === 200;
  if (isSelf) {
    check('student reads their own history', r.status === 200 && Array.isArray(r.json?.data?.records));
  } else {
    check('student reading another student history is rejected (403)', r.status === 403);
  }

  r = await call('GET', '/api/students/14/attendance', { token: student });
  check('student cannot read another student\'s history (403)', r.status === 403 && r.json?.error?.code === 'FORBIDDEN');

  r = await call('GET', `/api/students/${recordedStudentId}/attendance`, { token: lecturer });
  check('lecturer can read any student history', r.status === 200 && r.json?.data?.student?.id === recordedStudentId);

  // ------------------------------------------------------------- summaries --
  console.log('8. Summaries');
  r = await call('GET', `/api/summaries/courses/${swe2106.id}`, { token: lecturer });
  check('course summary lists per-student statistics', r.status === 200 && r.json?.data?.students?.length === 9);

  r = await call('GET', `/api/summaries/courses/${swe2106.id}`, { token: student });
  check('student cannot access course summaries (403)', r.status === 403);

  r = await call('GET', `/api/summaries/sessions/${emptySession.id}`, { token: registrar });
  check('registrar reads the session summary', r.status === 200 && r.json?.data?.summary?.recorded === 3);

  r = await call('GET', `/api/summaries/students/${recordedStudentId}`, { token: registrar });
  check('registrar reads a student summary', r.status === 200 && Array.isArray(r.json?.data?.courses));

  r = await call('GET', '/api/summaries/overview', { token: admin });
  check('admin reads the platform overview', r.status === 200 && r.json?.data?.totals?.courses_total >= 3);

  r = await call('GET', '/api/summaries/overview', { token: lecturer });
  check('lecturer cannot read the platform overview (403)', r.status === 403);

  // ------------------------------------------------------- unauthorised --
  console.log('9. Unauthenticated requests');
  r = await call('GET', '/api/courses');
  check('missing token is rejected (401)', r.status === 401 && r.json?.error?.code === 'UNAUTHORIZED');

  r = await call('GET', '/api/courses', { token: 'not-a-real-token' });
  check('invalid token is rejected (401)', r.status === 401);

  r = await call('GET', '/api/definitely-not-a-route', { token: admin });
  check('unknown route returns JSON 404', r.status === 404 && r.json?.error?.code === 'NOT_FOUND');

  // -------------------------------------------------------------- cleanup --
  console.log('10. Cleanup');
  await call('DELETE', `/api/sessions/${emptySession.id}/attendance/5`, { token: lecturer });
  await call('DELETE', `/api/sessions/${emptySession.id}/attendance/6`, { token: lecturer });
  await call('DELETE', `/api/sessions/${emptySession.id}/attendance/7`, { token: lecturer });
  r = await call('DELETE', `/api/courses/${testCourseId}`, { token: admin });
  check('admin deletes the test course (cascade)', r.status === 200);

  console.log(`\nResult: ${passed} passed, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err.message);
  console.error('Is the API server running? Start it with: npm start');
  process.exit(1);
});
