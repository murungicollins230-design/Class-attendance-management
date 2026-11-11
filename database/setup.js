/**
 * One-command setup: creates the database, the tables and the demo data.
 *   npm run setup
 *
 * NOTE: this DELETES existing data in the swe2106_attendance database.
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const seed = require('./seed');
const pool = require('../src/db');

async function main() {
  console.log('Step 1/2: creating database and tables ...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await connection.query(schema);
  await connection.end();
  console.log('[ok] Database "swe2106_attendance" is ready');

  console.log('Step 2/2: seeding demonstration data ...');
  await seed();
  await pool.end();
  console.log('\nSetup complete! Start the server with:   npm start');
}

main().catch((err) => {
  console.error('[!!] Setup failed:', err.message);
  process.exit(1);
});
