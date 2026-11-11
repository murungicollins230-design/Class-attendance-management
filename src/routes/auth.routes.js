/**
 * Authentication routes.
 *   POST /api/auth/login   -> obtain a bearer token
 *   GET  /api/auth/me      -> current user profile
 *   POST /api/auth/logout  -> invalidate the current token
 */
const router = require('express').Router();
const pool = require('../db');
const { ApiError, ok, asyncHandler } = require('../utils/respond');
const { requireFields } = require('../middleware/validate');
const { verifyPassword, issueToken, revokeToken, requireAuth } = require('../middleware/auth');

router.post('/login', asyncHandler(async (req, res) => {
  requireFields(req.body, {
    email: { type: 'email', maxLength: 120 },
    password: { type: 'string', maxLength: 120 },
  });

  const email = String(req.body.email).trim().toLowerCase();
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  if (!user || !verifyPassword(req.body.password, user.password_salt, user.password_hash)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }

  const token = issueToken(user.id);
  ok(res, {
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      student_number: user.student_number,
    },
  }, `Login successful. Welcome, ${user.full_name}.`);
}));

router.get('/me', requireAuth, (req, res) => {
  ok(res, req.user, 'Current user profile.');
});

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const token = (req.headers.authorization || '').split(' ')[1];
  revokeToken(token);
  ok(res, null, 'You have been logged out.');
}));

module.exports = router;
