/**
 * User administration routes (system administrator only).
 *   GET  /api/users -> list every account
 *   POST /api/users -> create a new account (any role)
 */
const router = require('express').Router();
const pool = require('../db');
const { ApiError, ok, asyncHandler } = require('../utils/respond');
const { requireAuth, requireRole, hashPassword, newSalt } = require('../middleware/auth');
const { requireFields, USER_ROLES } = require('../middleware/validate');

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, role, student_number, created_at
       FROM users
      ORDER BY role, full_name`
  );
  ok(res, rows, `${rows.length} user account(s).`);
}));

router.post('/', asyncHandler(async (req, res) => {
  requireFields(req.body, {
    full_name: { type: 'string', maxLength: 120 },
    email: { type: 'email', maxLength: 120 },
    password: { type: 'string', maxLength: 120 },
    role: { type: 'enum', values: USER_ROLES },
    student_number: { type: 'string', maxLength: 30, required: false },
  });

  const { full_name, email, password, role } = req.body;
  const student_number = req.body.student_number || null;

  if (role === 'student' && !student_number) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A student number is required for student accounts.', ['"student_number" is required when role is student.']);
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existingEmail.length) {
    throw new ApiError(409, 'DUPLICATE_ENTRY', `An account with email ${normalizedEmail} already exists.`);
  }
  if (student_number) {
    const [existingNumber] = await pool.query('SELECT id FROM users WHERE student_number = ?', [student_number]);
    if (existingNumber.length) {
      throw new ApiError(409, 'DUPLICATE_ENTRY', `Student number ${student_number} is already assigned to another account.`);
    }
  }

  const salt = newSalt();
  const [result] = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, password_salt, role, student_number)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [String(full_name).trim(), normalizedEmail, hashPassword(password, salt), salt, role, student_number]
  );

  const [created] = await pool.query(
    'SELECT id, full_name, email, role, student_number, created_at FROM users WHERE id = ?',
    [result.insertId]
  );
  ok(res, created[0], `Account for ${created[0].full_name} created successfully.`, 201);
}));

module.exports = router;
