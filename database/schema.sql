-- =====================================================================
-- SWE2106 Etivity 5 - Group G
-- Class Attendance Management System - MySQL Schema
-- Mbarara University of Science and Technology
-- =====================================================================
-- Tables:
--   users          -> all system accounts (admin, lecturer, student, registrar)
--   courses        -> demonstration courses, each owned by a lecturer
--   enrolments     -> which student is enrolled in which course (unique pair)
--   class_sessions -> a lecture/lab meeting for a course
--   attendance     -> one entry per student per session (unique pair)
--       status is restricted to present / absent / late by the database itself
-- =====================================================================

CREATE DATABASE IF NOT EXISTS swe2106_attendance
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE swe2106_attendance;

DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS class_sessions;
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  password_salt VARCHAR(64)  NOT NULL,
  role          ENUM('admin', 'lecturer', 'student', 'registrar') NOT NULL,
  student_number VARCHAR(30) NULL UNIQUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE courses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  title       VARCHAR(160) NOT NULL,
  study_year  VARCHAR(20)  NOT NULL DEFAULT 'Year 2',
  semester    VARCHAR(30)  NOT NULL DEFAULT 'Semester 1',
  lecturer_id INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_lecturer
    FOREIGN KEY (lecturer_id) REFERENCES users (id)
) ENGINE = InnoDB;

CREATE TABLE enrolments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  course_id   INT NOT NULL,
  student_id  INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_enrolment UNIQUE (course_id, student_id),
  CONSTRAINT fk_enrolment_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_enrolment_student
    FOREIGN KEY (student_id) REFERENCES users (id)
) ENGINE = InnoDB;

CREATE TABLE class_sessions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  course_id    INT NOT NULL,
  topic        VARCHAR(200) NOT NULL,
  session_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NULL,
  room         VARCHAR(60) NULL,
  created_by   INT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_course
    FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_session_creator
    FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE = InnoDB;

CREATE TABLE attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  session_id  INT NOT NULL,
  student_id  INT NOT NULL,
  status      ENUM('present', 'absent', 'late') NOT NULL,
  note        VARCHAR(200) NULL,
  recorded_by INT NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_attendance UNIQUE (session_id, student_id),
  CONSTRAINT fk_attendance_session
    FOREIGN KEY (session_id) REFERENCES class_sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES users (id),
  CONSTRAINT fk_attendance_recorder
    FOREIGN KEY (recorded_by) REFERENCES users (id)
) ENGINE = InnoDB;
