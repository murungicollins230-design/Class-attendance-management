/**
 * Authentication and role-based access control (prototype).
 *
 * - Passwords are stored as scrypt hashes with a per-user random salt.
 * - POST /api/auth/login issues a random bearer token. Tokens are kept in an
 *   in-memory map for the lifetime of the server process, which is enough for
 *   a classroom prototype (a production system would use signed JWTs / Redis).
 * - requireAuth   -> verifies the Authorization: Bearer <token> header
 * - requireRole   -> restricts a route to specific roles
 */
const crypto = require('node:crypto');
const pool = require('../db');
const { ApiError } = require('../utils/respond');

/** token -> user id */
const activeTokens = new Map();

function newSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const candidate = Buffer.from(hashPassword(password, salt), 'hex');
  const stored = Buffer.from(expectedHash, 'hex');
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

function issueToken(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  activeTokens.set(token, userId);
  return token;
}

function revokeToken(token) {
  if (token) activeTokens.delete(token);
}

/** Require a valid Bearer token; attaches req.user. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header. Expected format: Bearer <token>.');
    }
    const userId = activeTokens.get(token);
    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token. Please log in again.');
    }
    const [rows] = await pool.query(
      'SELECT id, full_name, email, role, student_number FROM users WHERE id = ?',
      [userId]
    );
    if (!rows.length) {
      throw new ApiError(401, 'UNAUTHORIZED', 'This account no longer exists.');
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

/** Restrict a route to the given roles. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(
        403,
        'FORBIDDEN',
        `Access denied. This action requires one of the roles: ${roles.join(', ')}. You are signed in as a ${req.user.role}.`
      ));
    }
    next();
  };
}

/**
 * Students may only view their own records; staff may view any student.
 * Used by the student history and summary routes.
 */
function studentCanOnlyAccessSelf(req, studentId) {
  if (req.user.role === 'student' && Number(req.user.id) !== Number(studentId)) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'Students may only view their own attendance records.'
    );
  }
}

module.exports = {
  newSalt,
  hashPassword,
  verifyPassword,
  issueToken,
  revokeToken,
  requireAuth,
  requireRole,
  studentCanOnlyAccessSelf,
};
