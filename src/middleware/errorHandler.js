/**
 * Central error handling.
 * All errors thrown anywhere in the API end up here and are converted into the
 * standard error envelope: { success: false, error: { code, message, details } }.
 */
const { ApiError } = require('../utils/respond');

/** JSON 404 for any unmatched /api route. */
function apiNotFound(req, res) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The route ${req.method} ${req.originalUrl} does not exist on this API.`,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Errors we raised deliberately
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Safety nets for database-level problems (belt and braces on top of the
  // explicit checks in the routes)
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'This record already exists. Duplicate entries are not allowed.',
      },
    });
  }
  if (err && err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REFERENCE',
        message: 'The request refers to a record that does not exist.',
      },
    });
  }

  // Anything else is a genuine server fault
  console.error('[SERVER_ERROR]', err);
  return res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: 'An unexpected server error occurred. Please try again.',
    },
  });
}

module.exports = { apiNotFound, errorHandler };
