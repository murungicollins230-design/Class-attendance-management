/**
 * Small fetch wrapper for the Class Attendance API.
 * - adds the Bearer token automatically
 * - unwraps the { success, message, data } envelope
 * - redirects to the login page when the token is no longer valid
 * - throws Error with the server's message when success is false
 */

async function apiFetch(path, options = {}) {
  const token = sessionStorage.getItem('token');
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(path, { ...options, headers });
  let body = null;
  try { body = await res.json(); } catch (_) { /* non-JSON response */ }

  if (res.status === 401) {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.href = '/index.html';
    throw new Error((body && body.error && body.error.message) || 'Please log in again.');
  }

  if (!body) throw new Error('The server returned an empty response.');
  if (!body.success) {
    const message = (body.error && body.error.message) || 'Request failed.';
    const details = body.error && body.error.details ? '\n' + body.error.details.join('\n') : '';
    throw new Error(message + details);
  }
  return body.data;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, data) => apiFetch(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => apiFetch(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
};
