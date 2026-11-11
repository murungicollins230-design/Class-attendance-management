/**
 * MySQL connection pool (live database).
 * Configuration is read from the .env file. DATE/DATETIME values are returned
 * as plain strings ("YYYY-MM-DD") so dates are never shifted by time zones.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'swe2106_attendance',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: ['DATE', 'DATETIME'],
});

module.exports = pool;
