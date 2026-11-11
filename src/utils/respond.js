/**
 * Consistent response helpers used by every route.
 *
 * Successful responses:
 *   { "success": true,  "message": "...", "data": ... }
 *
 * Failed responses:
 *   { "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
 */

class ApiError extends Error {
  /**
   * @param {number} status  HTTP status code
   * @param {string} code    machine-readable error code (see README)
   * @param {string} message human-readable explanation
   * @param {Array<string>|undefined} details extra validation details
   */
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Send a success envelope. */
function ok(res, data = null, message = 'Request successful', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

/** Wraps async route handlers so thrown errors reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { ApiError, ok, asyncHandler };
