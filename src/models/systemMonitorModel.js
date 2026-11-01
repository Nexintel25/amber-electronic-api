import pool from "../config/db.js";
import { mapResultSets } from "../utils/dbResults.js";

// Calls sp_record_heartbeat (one row per successful pinger call).
// Result set 1: { error_code, error_message }
// The SP also deletes monitor data older than 90 days once an hour.
export const recordHeartbeat = async ({ instance }) => {
  const [results] = await pool.query("CALL sp_record_heartbeat(?)", [
    instance ?? null,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
  };
};

// Calls sp_record_api_metric (upserts one row per minute: requests, 4xx, 5xx, total ms, max ms).
// No result set. Callers must not await this in the request path.
export const recordApiMetric = ({ status, ms }) =>
  pool.query("CALL sp_record_api_metric(?, ?)", [status ?? null, ms ?? null]);

// Known result sets of sp_system_overview, in order, after the status row.
// single: true -> the section is one row, returned as an object instead of an array.
const SYSTEM_OVERVIEW_SECTIONS = [
  { key: "health", single: true },
  { key: "incidents" }, // latest 20
  { key: "performance", single: true },
  { key: "hourly_trend" }, // last 24 h
  { key: "database", single: true },
  { key: "top_tables" }, // 10 largest
  { key: "activity", single: true },
];

// Calls sp_system_overview (super admin only).
// Result set 1: { error_code, error_message }
// Result sets 2-8 (only on success) are mapped by position to SYSTEM_OVERVIEW_SECTIONS;
// a result set the SP adds later is still returned as section_<n>.
export const getSystemOverview = async ({ userId, days, intervalMin }) => {
  const [results, fields] = await pool.query(
    "CALL sp_system_overview(?, ?, ?)",
    [userId ?? null, days, intervalMin]
  );

  const status = results[0][0];

  if (status.error_code !== 0) {
    return { code: status.error_code, message: status.error_message, data: null };
  }

  return {
    code: status.error_code,
    message: status.error_message,
    data: mapResultSets(results, fields, SYSTEM_OVERVIEW_SECTIONS),
  };
};
