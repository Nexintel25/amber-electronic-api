import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 30000,
  // return DATE columns as "YYYY-MM-DD" instead of a JS Date at local midnight,
  // which JSON-serializes to the previous day in UTC (e.g. IST +05:30)
  dateStrings: ["DATE"],
});

export default pool;
