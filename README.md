# Class Attendance Management System

**SWE2106 · Internet Technologies and Web Design · Etivity 5 · Group G**
Mbarara University of Science and Technology (MUST)

A full-stack web application that lets lecturers record and manage student attendance
for their courses, lets students view their own attendance history, and gives
registrar staff and administrators read-only oversight and account management.

> **Note on data:** the staff roles in this system (lecturers, administrator,
> registrar) are held by Group G members. Student records are a mix of group
> members and a few fictional demonstration students — no real MUST student
> data is used.

---

## Group G — Team members

All eleven members of Group G contributed through individual branches and pull
requests (see [How our team used Git and GitHub](#how-our-team-used-git-and-github)).
Members shown as *—* in the GitHub column get linked once they open their first
pull request.

| # | Member | Reg. No. | GitHub | Demo account in the system | Main responsibility |
|---|---|---|---|---|---|
| 1 | AINE DICKENS | 2025/BSE/127/PS | — | Lecturer (SWE2106, SWE2101) | Team lead · Express server structure & REST API design |
| 2 | MUSONIRWA IBRAHIM | 2025/BSE/093/PS | — | Lecturer (SWE2104) | Database schema, seed data, MySQL setup scripts |
| 3 | MURUNGI COLLINS | 2025/BSE/217/PS | [@murungicollins230-design](https://github.com/murungicollins230-design) | Administrator | Summaries/reporting endpoints · repository owner |
| 4 | KANYESIGYE OSBERT | 2025/BSE/241/PS | — | Registrar (read-only) | Documentation (README, demo script) & GitHub workflow |
| 5 | NKAMUSHABA SAVIOUR | 2025/BSE/136/PS | — | Student | Authentication: password hashing, tokens, role middleware |
| 6 | AYEBAZAMUKAMA JASTINA | 2025/BSE/054/PS | — | Student | Courses & enrolments endpoints |
| 7 | MUKIIBI JONATHAN JEREMIAH | 2025/BSE/215/PS | — | Student | Class sessions endpoints |
| 8 | TAREMWA EMMANUEL | 2025/BSE/170/PS | — | Student | Attendance recording, validation rules & duplicate checks |
| 9 | KAMUKAMA BENJAMIN | 2025/BSE/079/PS | [@2025bse079-ai](https://github.com/2025bse079-ai) | Student | Frontend: login page & role-aware dashboard |
| 10 | WORIPANERE JOSHUA | 2025/BSE/188/PS | [@2025bse188-crypto](https://github.com/2025bse188-crypto) | Student | Frontend: attendance register page |
| 11 | KABADIIMA EMMANUEL | 2025/BSE/207/PS | .[@Kabadiima-Emmanuel]
.(https://github.com/Kabadiima-Emmanuel).| Student | Postman collection & API tests |

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Users of the system](#users-of-the-system)
3. [Objectives](#objectives)
4. [Scope](#scope)
5. [Technology stack](#technology-stack)
6. [Project structure](#project-structure)
7. [Getting started](#getting-started)
8. [Demo accounts](#demo-accounts)
9. [Using the web frontend](#using-the-web-frontend)
10. [REST API reference](#rest-api-reference)
11. [Response format and error codes](#response-format-and-error-codes)
12. [Validation rules](#validation-rules)
13. [Database schema](#database-schema)
14. [Postman collection](#postman-collection)
15. [API smoke tests](#api-smoke-tests)
16. [Demonstration script (presentation)](#demonstration-script-presentation)
17. [How our team used Git and GitHub](#how-our-team-used-git-and-github)

---

## Problem statement

At MUST, class attendance for large classes is still captured on paper sign-in
sheets or ad-hoc spreadsheets. Registers get lost, tallying attendance percentages
at the end of a semester is slow and error-prone, students have no easy way to
know how many classes they have missed, and it is hard for the academic registrar
to review attendance statistics across courses.

The **Class Attendance Management System** solves this by providing one online
system in which lecturers create sessions for their courses, mark each student as
**present, absent or late** in a digital register, and immediately see attendance
summaries. Students can check their own history at any time, registrar staff can
review statistics without being able to change anything, and the administrator
manages courses, accounts and enrolments.

## Users of the system

| User | What they can do |
|---|---|
| **Lecturer** | See their own courses, create class sessions, record and update attendance (present / absent / late, with notes), view the register and per-student summaries for courses they teach. |
| **Student** | View their **own** attendance history and per-course attendance rate only. Cannot see other students' records or class registers. |
| **Registrar staff** | Read-only review of courses, registers, student histories and summaries. Cannot create or change anything. |
| **Administrator** | Manage user accounts, courses, class sessions and enrolments. Full access to all registers and summaries. |

## Objectives

1. Build a REST API with Express that follows the course → sessions → attendance workflow.
2. Store all data in a live MySQL database (no arrays or in-memory storage).
3. Enforce server-side validation on every write: required fields, correct formats, enrolment checks, allowed status values, and rejection of duplicate entries.
4. Use consistent JSON response envelopes and clear error codes for every endpoint.
5. Provide a JavaScript frontend (HTML/CSS/vanilla JS) connected to the live database through the API.
6. Document and test the API with a Postman collection covering valid and invalid requests.
7. Use fictional demonstration data only.

## Scope

**In scope (this etivity):** authentication with roles, courses, enrolments, class
sessions, attendance registers (present / absent / late + notes), attendance
histories, per-student / per-course / per-session / platform summaries, and an
admin area for accounts and courses.

**Out of scope (future work):** email/SMS notifications, QR-code or biometric
check-in, timetable integration with the MUST student records system, exporting
reports to PDF/Excel, and multi-department support.

## Technology stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (LTS) |
| API framework | Express 4 |
| Database | MySQL 8 (project-local instance on port **3307**, user `root`, empty password) |
| DB driver | mysql2 (connection pool, prepared statements) |
| Frontend | HTML5, CSS3, vanilla JavaScript (fetch API) |
| API testing | Postman collection + Node smoke-test script |
| Auth | Bearer tokens, passwords hashed with scrypt + per-user salt |

## Project structure

```
class-attendance-system/
├── server.js                  # entry point (starts Express)
├── START-APP.cmd              # one-click launcher (database + API + browser)
├── src/
│   ├── app.js                 # Express app, route mounting, static frontend
│   ├── db.js                  # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js            # password hashing, tokens, requireAuth/requireRole
│   │   ├── validate.js        # field validation helpers
│   │   └── errorHandler.js    # JSON 404 + central error handler
│   ├── routes/                # auth, users, courses, sessions, students, summaries
│   └── utils/                 # response envelopes, access checks
├── database/
│   ├── schema.sql             # MySQL DDL (tables, constraints, indexes)
│   ├── seed.js                # demo data (npm run seed)
│   ├── setup.js               # schema + seed in one command (npm run setup)
│   ├── start-database.cmd     # starts the project's MySQL server on port 3307
│   ├── mysql-3307.ini         # MySQL config for the project instance
│   └── mysql-data/            # the live database files (git-ignored)
├── public/                    # the web frontend
│   ├── index.html             # login page
│   ├── dashboard.html         # role-aware dashboard
│   ├── course.html            # sessions, enrolled students, summary
│   ├── session.html           # attendance register (present/absent/late)
│   ├── student.html           # attendance history
│   ├── css/styles.css
│   └── js/                    # api.js, ui.js, login.js, dashboard.js, ...
├── postman/
│   └── SWE2106-ClassAttendance.postman_collection.json
├── scripts/
│   └── smoke-test.js          # 47-check API test runner
├── .env                       # local configuration (git-ignored)
├── .env.example               # template for .env
└── package.json
```

## Getting started

### Prerequisites

- **Node.js** 18 or newer — <https://nodejs.org>
- A **MySQL 8** server. The repository includes a one-click script that runs a
  dedicated MySQL instance on port **3307** using a MySQL installation it finds
  on the machine (it tries WAMP first, then any `mysqld` on your PATH, then a
  standard MySQL 8 install; edit the `MYSQLD` path in
  `database\start-database.cmd` if yours is elsewhere). Alternatively use any
  MySQL you already have and adjust `.env`.

### Quick start (Windows — one double-click)

Double-click **`START-APP.cmd`** in the project folder. It installs the Node
dependencies on first run, starts the project database (MySQL on port 3307),
creates and seeds the database on first run, starts the web application on
port 3000, and opens **<http://localhost:3000>** in your browser.

Keep the two black server windows open while you use the system, and close them
when you are done. The manual steps below do exactly the same thing.

### Setup steps (Windows)

```bat
:: 1. start the project's own MySQL server (port 3307, root / no password)
database\start-database.cmd

:: 2. install dependencies (in a second terminal)
npm install

:: 3. create the database, tables and demo data
npm run setup

:: 4. start the API + frontend
npm start
```

Then open **<http://localhost:3000>** in your browser and log in with any
[demo account](#demo-accounts) below.

### What each script does

| Command | Description |
|---|---|
| `database\start-database.cmd` | Starts the dedicated MySQL instance on port 3307. On first run it initialises the data directory automatically (root / empty password). Keep the window open. |
| `START-APP.cmd` | One-click launcher: starts the database and the API server (installing/seeding on first run), then opens the browser. |
| `npm install` | Installs Express, mysql2, dotenv. |
| `npm run setup` | Runs `database/schema.sql` (drops and recreates the DB) **and** seeds demo data. |
| `npm run seed` | Re-seeds demo data only (resets to the pristine demo state). |
| `npm start` | Starts the server on port 3000 (`node server.js`). |
| `npm run dev` | Same but auto-restarts on file changes (`node --watch`). |
| `node scripts/smoke-test.js` | Runs the 47-check API test suite against a running server. |

### Configuration

`.env` (copy from `.env.example`):

```ini
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=swe2106_attendance
```

If your machine reboots, just re-run `database\start-database.cmd` and then
`npm start` — the data persists in `database/mysql-data/`.

## Demo accounts

All passwords are deliberately simple — this is demonstration data only.

| Role | Name | Email | Password |
|---|---|---|---|
| Administrator | MURUNGI COLLINS | collins.murungi@must.ac.ug | `admin123` |
| Lecturer (SWE2106, SWE2101) | AINE DICKENS | dickens.aine@must.ac.ug | `lecturer123` |
| Lecturer (SWE2104) | MUSONIRWA IBRAHIM | ibrahim.musonirwa@must.ac.ug | `lecturer123` |
| Registrar (read-only) | KANYESIGYE OSBERT | osbert.kanyesigye@must.ac.ug | `registrar123` |
| Student | NKAMUSHABA SAVIOUR | savour.nkamushaba@student.must.ac.ug | `student123` |

Students log in with `<firstname>.<lastname>@student.must.ac.ug` / `student123`
(e.g. `jastina.ayebazamukama@student.must.ac.ug`). The login page has
one-click buttons for the five main demo accounts.

The seed data contains **14 accounts, 3 courses, 20 enrolments, 15 class
sessions and 101 attendance entries** (overall attendance rate 88%). The SWE2106 session **"Building REST APIs with Express"
(11 Nov 2026)** is intentionally left with an **empty register** so the full
recording workflow can be demonstrated live. The fictional demonstration
student **NAMARA JANE** is intentionally **not enrolled** in SWE2106 to
demonstrate the "student is not enrolled" validation error.

## Using the web frontend

| Page | URL | Who / what |
|---|---|---|
| Login | `/index.html` | All users; one-click demo account fill |
| Dashboard | `/dashboard.html` | Lecturers see their course cards with attendance rates; students see their own summary + recent records; registrar sees read-only statistics; admin sees platform overview plus course/user creation forms |
| Course | `/course.html?id=1` | Sessions list, enrolled students, attendance summary; lecturers/admin can create sessions and enrol students |
| Register | `/session.html?id=8` | The attendance register: present/absent/late radios + notes per student, live counters, save button (lecturer/admin); registrar read-only |
| History | `/student.html?id=5` | A student's full attendance history with statuses and notes; students can only open their own |

## REST API reference

Base URL: `http://localhost:3000`. All endpoints except login and health require
an `Authorization: Bearer <token>` header obtained from `POST /api/auth/login`.

### Authentication

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Log in (`email`, `password`) → token + user |
| GET | `/api/auth/me` | any | Current user profile |
| POST | `/api/auth/logout` | any | Invalidates the token |

### Users (admin)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List all accounts |
| POST | `/api/users` | Create an account (`full_name`, `email`, `password`, `role`, `student_number` for students) |

### Courses

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/courses` | any (scoped) | Lecturers: their courses; students: enrolled courses; registrar/admin: all |
| GET | `/api/courses/:id` | any (scoped) | Course detail + statistics |
| POST | `/api/courses` | admin | Create course (`code`, `title`, `lecturer_id`, …) |
| DELETE | `/api/courses/:id` | admin | Delete course (cascades) |
| GET | `/api/courses/:id/students` | staff | Enrolled students |
| POST | `/api/courses/:id/enrolments` | admin / owning lecturer | Enrol a student |
| DELETE | `/api/courses/:id/enrolments/:studentId` | admin / owning lecturer | Remove an enrolment |
| GET | `/api/courses/:id/sessions` | any (scoped) | Sessions with recorded counts |
| POST | `/api/courses/:id/sessions` | admin / owning lecturer | Create a class session |

### Sessions & attendance

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/sessions/:id` | any (scoped) | Session detail |
| GET | `/api/sessions/:id/register` | staff | Full register (all enrolled students, status or unrecorded) + summary |
| PUT | `/api/sessions/:id/register` | admin / owning lecturer | Bulk save of the register (`entries: [{student_id, status, note?}]`) |
| POST | `/api/sessions/:id/attendance` | admin / owning lecturer | Record one entry (`student_id`, `status`, optional `note`) |
| PUT | `/api/sessions/:id/attendance/:studentId` | admin / owning lecturer | Update an entry |
| DELETE | `/api/sessions/:id/attendance/:studentId` | admin / owning lecturer | Delete an entry |

### Students & histories

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/students?not_enrolled_in=:courseId` | staff | Students (optionally filtered, powers the enrol form) |
| GET | `/api/students/:id` | staff / self | Student profile + enrolled courses |
| GET | `/api/students/:id/attendance?course_id=` | staff / **self only** | Attendance history (students only see their own) |

### Summaries

| Method | Endpoint | Roles | Description |
|---|---|---|---|
| GET | `/api/summaries/overview` | admin, registrar | Platform totals + per-course rates |
| GET | `/api/summaries/courses/:id` | staff | Per-student statistics for a course |
| GET | `/api/summaries/sessions/:id` | staff | Counts for one session |
| GET | `/api/summaries/students/:id` | staff / self | Per-course breakdown for a student |

### Utility

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Liveness + database connectivity check |

## Response format and error codes

Every response uses the same envelope:

```json
// success
{ "success": true, "message": "…", "data": { } }

// failure
{ "success": false, "error": { "code": "…", "message": "…", "details": ["…"] } }
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing/invalid fields, bad date/time format, unknown status, duplicate student in a bulk request |
| `NOT_ENROLLED` | 400 | Attendance recorded for a student not enrolled in the course |
| `UNAUTHORIZED` | 401 | Missing, invalid or expired token |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `FORBIDDEN` | 403 | Role not allowed, lecturer not teaching the course, student reading another student's data |
| `*_NOT_FOUND` | 404 | Referenced course / session / student / entry does not exist |
| `DUPLICATE_ENTRY` | 409 | Duplicate course code, enrolment or attendance entry |
| `SERVER_ERROR` | 500 | Unexpected fault (caught centrally, never leaks stack traces) |

## Validation rules

All rules are enforced **on the server** (the frontend mirrors some of them for
usability, but the API is the authority):

- **Login:** email and password are required; wrong credentials return a generic
  `INVALID_CREDENTIALS` message (no hints about which part was wrong).
- **Courses:** `code` (unique, ≤ 20 chars) and `title` required; `lecturer_id`
  must reference an existing lecturer; only admins can create courses.
- **Sessions:** `topic` and `session_date` required; dates must be `YYYY-MM-DD`;
  times `HH:MM`; end time must not be before start time; only the course's
  lecturer or an admin can create sessions.
- **Enrolments:** the student must exist and not already be enrolled
  (duplicates rejected with 409).
- **Attendance:** `status` must be one of `present`, `absent`, `late`;
  the student must be enrolled in the course; one entry per student per session
  (duplicates rejected with 409); optional `note` ≤ 500 chars. The bulk register
  save validates **every** entry first and then writes them in a single
  transaction — if any entry is invalid, nothing is saved.
- **Access control:** students can only read their own records; lecturers only
  manage courses they teach; registrars only read; admins manage everything.

**Attendance rate** = attended ÷ recorded, where attended = present + late.

## Database schema

Database name: `swe2106_attendance` (MySQL 8, InnoDB).

```
users            (id, full_name, email UNIQUE, password_hash, salt, role
                  ENUM('admin','lecturer','registrar','student'),
                  student_number NULL UNIQUE, created_at)

courses          (id, code UNIQUE, title, lecturer_id → users.id,
                  study_year, semester, created_at)

enrolments       (id, course_id → courses.id, student_id → users.id,
                  enrolled_at, UNIQUE(course_id, student_id))

class_sessions   (id, course_id → courses.id, topic, session_date DATE,
                  start_time TIME, end_time TIME NULL, room,
                  created_by → users.id, created_at)

attendance        (id, session_id → class_sessions.id,
                  student_id → users.id, status ENUM('present','absent','late'),
                  note NULL, recorded_by → users.id, recorded_at,
                  UNIQUE(session_id, student_id))
```

Cascade deletes: removing a course removes its enrolments, sessions and
attendance entries; removing a session removes its attendance entries.

## Postman collection

Import **`postman/SWE2106-ClassAttendance.postman_collection.json`** into
Postman. It contains **50 documented requests in 9 folders**:

| Folder | Shows |
|---|---|
| 0 · Health & Logins | Health check + tokens for every role (saved as collection variables) |
| 1 · Courses | Listing (scoped by role), creation, **duplicate code → 409**, **missing fields → 400**, **lecturer → 403** |
| 2 · Enrolments | Enrol, **duplicate enrolment → 409**, **unknown student → 404**, listing |
| 3 · Class Sessions | Listing, creation, **bad date → 400**, **wrong lecturer → 403** |
| 4 · Attendance | Record present, **duplicate → 409**, **unknown status → 400**, **not enrolled → 400**, **student → 403**, update to late, bulk register save, register view |
| 5 · Histories | Own history, **other student → 403**, staff view, profile |
| 6 · Summaries | Course / session / student / platform summaries, **lecturer overview → 403** |
| 7 · Access Control | **No token → 401**, **bad token → 401**, wrong password → 401, **unknown route → 404 JSON**, admin user list |
| 8 · Cleanup | Removes the records the collection created so it can be re-run |

Run the folders **top to bottom** — later requests use variables captured by
earlier tests. Before re-running the whole collection, run the **Cleanup**
folder first, or reset everything with `npm run seed`.

## API smoke tests

`node scripts/smoke-test.js` (server must be running) executes the same workflow
as the Postman collection — 47 checks across health, auth, roles, validation,
attendance, summaries and access control — and cleans up after itself:

```
1. Health check ............ PASS
2. Authentication .......... PASS (6 checks)
3. Courses ................. PASS (5 checks)
...
Result: 47 passed, 0 failed.
```

## Demonstration script (presentation)

1. **Start everything:** `database\start-database.cmd`, then `npm start`.
2. **Login as the lecturer (Dickens)** from `http://localhost:3000` — show the
   dashboard with SWE2106 (9 students, 8 sessions, 90% attendance).
3. **Open SWE2106 → sessions** — point out today's session
   *"Building REST APIs with Express"* with an empty register.
4. **Open the register** — mark a few students present / absent / late, add a
   note, show the live counters, and **Save** — "Register saved: N attendance
   entries recorded." Reload to prove it persisted to MySQL.
5. **Show validation:** in Postman, try recording attendance twice for the
   same student (**409 DUPLICATE_ENTRY**), an invalid status like `excused`
   (**400**), and the fictional student NAMARA JANE (id 14) who is not enrolled
   (**400 NOT_ENROLLED**).
6. **Login as the student (Savour)** — show her dashboard (own rate per course)
   and history; try opening another student's history → **403**.
7. **Login as the registrar (Osbert)** — read-only overview and summaries;
   attempt a write → **403**.
8. **Login as the admin (Collins)** — platform overview, create a course/user.
9. **Run the Postman collection** (or `node scripts/smoke-test.js`) — all tests pass.

## How our team used Git and GitHub

Repository: <https://github.com/murungicollins230-design/Class-attendance-management>

- `main` holds the working application at all times.
- Every member is added as a **collaborator** (repository *Settings →
  Collaborators*) and works from their own clone of the repository.
- Each member worked on a **feature branch** named after their responsibility
  (e.g. `feature/auth-middleware`, `feature/attendance-validation`,
  `feature/frontend-register`).
- Changes reached `main` only through **pull requests** reviewed by the team
  lead, so every member's contribution is visible in the repository's commit
  history and PR list.
- To contribute a change:

```bash
git checkout main && git pull origin main
git checkout -b feature/your-topic
# ... make changes ...
git add . && git commit -m "Describe your change"
git push -u origin feature/your-topic
# then open a pull request on GitHub for review
```

---

© 2026 Group G · SWE2106 · Mbarara University of Science and Technology.
Educational prototype 
