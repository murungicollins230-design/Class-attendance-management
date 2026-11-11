/**
 * Server-side input validation.
 *
 * Every write endpoint validates its input BEFORE touching the database, so
 * duplicate, incomplete, or invalid entries are rejected with a clear message.
 *
 * requireFields(body, spec) throws ApiError(400, 'VALIDATION_ERROR', ...) with
 * a list of every problem found, e.g.:
 *   { field: 'status', type: 'enum', values: ['present','absent','late'] }
 */
const { ApiError } = require('../utils/respond');

const ATTENDANCE_STATUSES = ['present', 'absent', 'late'];
const USER_ROLES = ['admin', 'lecturer', 'student', 'registrar'];

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const isDate = (v) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v);

const isMissing = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Validate fields of an object against a spec.
 * spec example:
 *   { topic: { type: 'string', maxLength: 200 },
 *     session_date: { type: 'date' } }
 * A field is required unless { required: false } is given.
 */
function requireFields(source, spec) {
  const errors = [];
  for (const [field, rule] of Object.entries(spec)) {
    const value = source ? source[field] : undefined;

    if (isMissing(value)) {
      if (rule.required !== false) errors.push(`"${field}" is required.`);
      continue;
    }

    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`"${field}" must be a string.`);
      continue;
    }
    if (rule.type === 'email' && !isEmail(value)) {
      errors.push(`"${field}" must be a valid email address.`);
      continue;
    }
    if (rule.type === 'date' && !isDate(value)) {
      errors.push(`"${field}" must be a valid date in YYYY-MM-DD format.`);
      continue;
    }
    if (rule.type === 'time' && !isTime(value)) {
      errors.push(`"${field}" must be a valid time in HH:MM format.`);
      continue;
    }
    if (rule.type === 'int' && !(Number.isInteger(Number(value)) && Number(value) > 0)) {
      errors.push(`"${field}" must be a positive integer.`);
      continue;
    }
    if (rule.type === 'enum' && !rule.values.includes(value)) {
      errors.push(`"${field}" must be one of: ${rule.values.join(', ')}.`);
      continue;
    }
    if (rule.type === 'array' && !Array.isArray(value)) {
      errors.push(`"${field}" must be an array.`);
      continue;
    }
    if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
      errors.push(`"${field}" must not exceed ${rule.maxLength} characters.`);
    }
  }

  if (errors.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid or missing fields.', errors);
  }
}

/** Validate an attendance status value. */
function requireValidStatus(status) {
  if (!ATTENDANCE_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `Invalid attendance status "${status}". Allowed values: present, absent, late.`,
      [`"status" must be one of: ${ATTENDANCE_STATUSES.join(', ')}.`]
    );
  }
}

/** Parse and validate a numeric route parameter (e.g. /api/students/:id). */
function paramInt(req, key) {
  const raw = req.params[key];
  if (!/^\d+$/.test(raw)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Route parameter "${key}" must be a positive integer.`);
  }
  return Number(raw);
}

module.exports = {
  ATTENDANCE_STATUSES,
  USER_ROLES,
  requireFields,
  requireValidStatus,
  paramInt,
  isEmail,
  isDate,
  isTime,
};
