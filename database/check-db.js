/**
 * Quick database connectivity check used by START-APP.cmd.
 * Exits 0 when the project database is reachable, 1 otherwise.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'swe2106_attendance',
    });
    await conn.end();
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
})();
