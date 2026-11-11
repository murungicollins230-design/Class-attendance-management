/**
 * Seed script — fictional DEMONSTRATION data only.
 *
 * This data is entirely made up for the prototype. It does not connect to any
 * real MUST system and contains no real student records. Team member names are
 * reused as demo accounts for convenience.
 *
 * Run on its own:          npm run seed
 * Or as part of full setup: npm run setup  (schema + this seed)
 *
 * Staff roles (lecturer, admin, registrar) are held by Group G members:
 *   lecturer  dickens.aine@must.ac.ug            -> lecturer123
 *   lecturer  ibrahim.musonirwa@must.ac.ug       -> lecturer123
 *   admin     collins.murungi@must.ac.ug         -> admin123
 *   registrar osbert.kanyesigye@must.ac.ug       -> registrar123
 *   students  <firstname>.<lastname>@student.must.ac.ug -> student123
 */
require('dotenv').config();
const pool = require('../src/db');
const { hashPassword, newSalt } = require('../src/middleware/auth');

// ------------------------------------------------------------------ users ---

// Staff roles (lecturer, admin, registrar) are held by Group G members.
// Students are a mix of group members and a few fictional demonstration
// records (Miriam, David, Jane) so registers look realistic.
const DEMO_USERS = [
  // staff (Group G members)
  { full_name: 'AINE DICKENS', email: 'dickens.aine@must.ac.ug', password: 'lecturer123', role: 'lecturer' },
  { full_name: 'MUSONIRWA IBRAHIM', email: 'ibrahim.musonirwa@must.ac.ug', password: 'lecturer123', role: 'lecturer' },
  { full_name: 'MURUNGI COLLINS', email: 'collins.murungi@must.ac.ug', password: 'admin123', role: 'admin' },
  { full_name: 'KANYESIGYE OSBERT', email: 'osbert.kanyesigye@must.ac.ug', password: 'registrar123', role: 'registrar' },
  // students (Group G members)
  { full_name: 'NKAMUSHABA SAVIOUR', email: 'savour.nkamushaba@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/136/PS' },
  { full_name: 'AYEBAZAMUKAMA JASTINA', email: 'jastina.ayebazamukama@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/054/PS' },
  { full_name: 'MUKIIBI JONATHAN JEREMIAH', email: 'jonathan.mukiibi@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/215/PS' },
  { full_name: 'TAREMWA EMMANUEL', email: 'emmanuel.taremwa@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/170/PS' },
  { full_name: 'KAMUKAMA BENJAMIN', email: 'benjamin.kamukama@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/079/PS' },
  { full_name: 'WORIPANERE JOSHUA', email: 'joshua.woripanere@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/188/PS' },
  { full_name: 'KABADIIMA EMMANUEL', email: 'emmanuel.kabadiima@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/207/PS' },
  // students (fictional demonstration records — not group members)
  { full_name: 'NAKATO MIRIAM', email: 'miriam.nakato@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/150/PS' },
  { full_name: 'OKELLO DAVID', email: 'david.okello@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/161/PS' },
  { full_name: 'NAMARA JANE', email: 'jane.namara@student.must.ac.ug', password: 'student123', role: 'student', student_number: '2025/BSE/172/PS' },
];

// ---------------------------------------------------------------- courses ---

const DEMO_COURSES = [
  { code: 'SWE2106', title: 'Internet Technologies and Web Design', lecturer: 'dickens.aine@must.ac.ug', study_year: 'Year 2', semester: 'Semester 1' },
  { code: 'SWE2104', title: 'Data Structures and Algorithms', lecturer: 'ibrahim.musonirwa@must.ac.ug', study_year: 'Year 2', semester: 'Semester 1' },
  { code: 'SWE2101', title: 'Object-Oriented Programming', lecturer: 'dickens.aine@must.ac.ug', study_year: 'Year 2', semester: 'Semester 1' },
];

// -------------------------------------------------------------- enrolments ---

const DEMO_ENROLMENTS = {
  SWE2106: [
    'savour.nkamushaba@student.must.ac.ug',
    'jastina.ayebazamukama@student.must.ac.ug',
    'jonathan.mukiibi@student.must.ac.ug',
    'emmanuel.taremwa@student.must.ac.ug',
    'benjamin.kamukama@student.must.ac.ug',
    'joshua.woripanere@student.must.ac.ug',
    'emmanuel.kabadiima@student.must.ac.ug',
    'miriam.nakato@student.must.ac.ug',
    'david.okello@student.must.ac.ug',
    // NOTE: jane.namara@student.must.ac.ug (a fictional demonstration student)
    // is deliberately NOT enrolled in SWE2106 so the "student is not enrolled"
    // validation can be demonstrated.
  ],
  SWE2104: [
    'savour.nkamushaba@student.must.ac.ug',
    'jastina.ayebazamukama@student.must.ac.ug',
    'jonathan.mukiibi@student.must.ac.ug',
    'emmanuel.taremwa@student.must.ac.ug',
    'miriam.nakato@student.must.ac.ug',
    'david.okello@student.must.ac.ug',
    'jane.namara@student.must.ac.ug',
  ],
  SWE2101: [
    'emmanuel.taremwa@student.must.ac.ug',
    'benjamin.kamukama@student.must.ac.ug',
    'emmanuel.kabadiima@student.must.ac.ug',
    'jane.namara@student.must.ac.ug',
  ],
};

// --------------------------------------------------------------- sessions ---

const DEMO_SESSIONS = {
  SWE2106: [
    { topic: 'Course Introduction and HTML Basics', session_date: '2026-09-14', start_time: '09:00', end_time: '11:00', room: 'LH3' },
    { topic: 'HTML Forms, Tables and Semantic Markup', session_date: '2026-09-21', start_time: '09:00', end_time: '11:00', room: 'LH3' },
    { topic: 'CSS Styling, Selectors and the Box Model', session_date: '2026-09-28', start_time: '09:00', end_time: '11:00', room: 'LH3' },
    { topic: 'Responsive Layouts with Flexbox and Grid', session_date: '2026-10-05', start_time: '09:00', end_time: '11:00', room: 'LH3' },
    { topic: 'JavaScript Fundamentals', session_date: '2026-10-19', start_time: '09:00', end_time: '11:00', room: 'LH3' },
    { topic: 'DOM Manipulation and Events', session_date: '2026-10-26', start_time: '09:00', end_time: '11:00', room: 'LH3' },
    { topic: 'Node.js, npm and Express Setup', session_date: '2026-11-09', start_time: '09:00', end_time: '11:00', room: 'LH3', partial: true },
    { topic: 'Building REST APIs with Express', session_date: '2026-11-11', start_time: '09:00', end_time: '11:00', room: 'LH3', skip: true },
  ],
  SWE2104: [
    { topic: 'Arrays and Complexity Analysis', session_date: '2026-09-16', start_time: '14:00', end_time: '16:00', room: 'LT2' },
    { topic: 'Stacks and Queues', session_date: '2026-09-30', start_time: '14:00', end_time: '16:00', room: 'LT2' },
    { topic: 'Linked Lists', session_date: '2026-10-14', start_time: '14:00', end_time: '16:00', room: 'LT2' },
    { topic: 'Binary Trees and Traversals', session_date: '2026-11-04', start_time: '14:00', end_time: '16:00', room: 'LT2' },
  ],
  SWE2101: [
    { topic: 'Classes, Objects and Constructors', session_date: '2026-09-15', start_time: '11:00', end_time: '13:00', room: 'LH1' },
    { topic: 'Inheritance and Polymorphism', session_date: '2026-10-06', start_time: '11:00', end_time: '13:00', room: 'LH1' },
    { topic: 'Interfaces and Collections', session_date: '2026-10-27', start_time: '11:00', end_time: '13:00', room: 'LH1' },
  ],
};

// -------------------------------------------------------------------- seed ---

async function run() {
  console.log('Seeding fictional demonstration data ...');

  // wipe existing data, keeping the schema
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of ['attendance', 'class_sessions', 'enrolments', 'courses', 'users']) {
    await pool.query(`TRUNCATE TABLE ${table}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  // users
  const userId = {};
  for (const user of DEMO_USERS) {
    const salt = newSalt();
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, password_salt, role, student_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.full_name, user.email, hashPassword(user.password, salt), salt, user.role, user.student_number || null]
    );
    userId[user.email] = result.insertId;
  }
  console.log(`[ok] ${DEMO_USERS.length} user accounts created`);

  // courses
  const courseId = {};
  for (const course of DEMO_COURSES) {
    const [result] = await pool.query(
      `INSERT INTO courses (code, title, study_year, semester, lecturer_id) VALUES (?, ?, ?, ?, ?)`,
      [course.code, course.title, course.study_year, course.semester, userId[course.lecturer]]
    );
    courseId[course.code] = result.insertId;
  }
  console.log(`[ok] ${DEMO_COURSES.length} courses created`);

  // enrolments
  const enrolmentsByCourse = {};
  for (const [code, students] of Object.entries(DEMO_ENROLMENTS)) {
    enrolmentsByCourse[code] = [];
    for (const email of students) {
      await pool.query('INSERT INTO enrolments (course_id, student_id) VALUES (?, ?)', [courseId[code], userId[email]]);
      enrolmentsByCourse[code].push(userId[email]);
    }
  }
  console.log('[ok] enrolments created');

  // sessions + attendance
  let sessionCount = 0;
  let attendanceCount = 0;

  for (const [code, sessions] of Object.entries(DEMO_SESSIONS)) {
    const lecturerEmail = DEMO_COURSES.find((c) => c.code === code).lecturer;
    const enrolled = enrolmentsByCourse[code];

    for (let ti = 0; ti < sessions.length; ti += 1) {
      const s = sessions[ti];
      const [result] = await pool.query(
        `INSERT INTO class_sessions (course_id, topic, session_date, start_time, end_time, room, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [courseId[code], s.topic, s.session_date, s.start_time, s.end_time, s.room, userId[lecturerEmail]]
      );
      sessionCount += 1;
      const sessionId = result.insertId;

      if (s.skip) continue; // today's session: left empty for the live demo

      // "partial" sessions demonstrate an in-progress register
      const studentsToRecord = s.partial ? enrolled.slice(0, 7) : enrolled;

      for (let si = 0; si < studentsToRecord.length; si += 1) {
        const studentId = studentsToRecord[si];
        let status = 'present';
        let note = null;
        if ((si + ti) % 9 === 4) {
          status = 'absent';
          if ((si + ti) % 3 === 0) note = 'Approved excuse (medical)';
        } else if ((si + ti) % 7 === 3) {
          status = 'late';
          if ((si + ti) % 2 === 0) note = 'Arrived 15 minutes late';
        }
        await pool.query(
          `INSERT INTO attendance (session_id, student_id, status, note, recorded_by)
           VALUES (?, ?, ?, ?, ?)`,
          [sessionId, studentId, status, note, userId[lecturerEmail]]
        );
        attendanceCount += 1;
      }
    }
  }
  console.log(`[ok] ${sessionCount} class sessions created`);
  console.log(`[ok] ${attendanceCount} attendance entries created`);
  console.log('[ok] Session "Building REST APIs with Express" (SWE2106) is left empty for the live demo');
}

module.exports = run;

// Allow "npm run seed" on its own
if (require.main === module) {
  run()
    .then(() => pool.end())
    .then(() => console.log('Seed complete.'))
    .catch((err) => {
      console.error('[!!] Seed failed:', err.message);
      process.exit(1);
    });
}
