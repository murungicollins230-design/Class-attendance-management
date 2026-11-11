/**
 * Server entry point.
 * Verifies the live MySQL connection before accepting requests.
 */
require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/db');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('[ok] Connected to MySQL database:', process.env.DB_NAME || 'swe2106_attendance');
  } catch (err) {
    console.error('[!!] Could not connect to MySQL.');
    console.error('     Check the settings in .env and make sure MySQL is running.');
    console.error('     Error:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log('[ok] Class Attendance Management System (Group G)');
    console.log(`     Frontend : http://localhost:${PORT}/`);
    console.log(`     API health: http://localhost:${PORT}/api/health`);
    console.log(`     First run? npm run setup   (creates database + demo data)`);
  });
})();
