/**
 * Express application setup.
 * - JSON body parsing
 * - static frontend served from /public
 * - all REST endpoints under /api
 * - centralised 404 + error handling
 */
const path = require('node:path');
const express = require('express');
const pool = require('./db');
const { ok } = require('./utils/respond');
const { apiNotFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const coursesRoutes = require('./routes/courses.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const studentsRoutes = require('./routes/students.routes');
const summariesRoutes = require('./routes/summaries.routes');

const app = express();

app.use(express.json());

// Serve the JavaScript frontend (same origin, so no CORS configuration needed)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple health check used in Postman and in the README
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    ok(res, { status: 'ok', database: 'connected' }, 'API is healthy.');
  } catch {
    res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'API is up but the database is unreachable.' } });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/summaries', summariesRoutes);

// Any unmatched /api route -> JSON 404; everything else falls through to 404
app.use('/api', apiNotFound);

app.use(errorHandler);

module.exports = app;
