import pool from "../config/db.js";

// Calls sp_get_complaint_types.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): complaint type rows
export const getComplaintTypes = async ({ onlyActive }) => {
  const [results] = await pool.query("CALL sp_get_complaint_types(?)", [
    onlyActive ? 1 : 0,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_get_buildings.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): building rows visible to the user (role based)
export const getBuildings = async ({ userId, onlyActive, search }) => {
  const [results] = await pool.query("CALL sp_get_buildings(?, ?, ?)", [
    userId ?? null,
    onlyActive ? 1 : 0,
    search ?? null,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_get_vendors.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): vendor rows visible to the user (role based)
export const getVendors = async ({ userId, onlyActive, search }) => {
  const [results] = await pool.query("CALL sp_get_vendors(?, ?, ?)", [
    userId ?? null,
    onlyActive ? 1 : 0,
    search ?? null,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_get_user_types.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): user type rows
export const getUserTypes = async ({ onlyActive }) => {
  const [results] = await pool.query("CALL sp_get_user_types(?)", [
    onlyActive ? 1 : 0,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_report_benchmark.
// Result set 1: { error_code, error_message, month }
// Result set 2 (only on success): summary { month, minor_complaints_counted, green, yellow, red, ontime_pct, breaches, total_penalty }
// Result set 3 (only on success): rows by category
// Result set 4 (only on success): rows by vendor + category
export const getBenchmarkReport = async ({ userId, month, vendorId }) => {
  const [results] = await pool.query("CALL sp_report_benchmark(?, ?, ?)", [
    userId ?? null,
    month ?? null,
    vendorId ?? null,
  ]);

  const status = results[0][0];
  const summary = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const byCategory = Array.isArray(results[2]) ? results[2] : [];
  const byVendor = Array.isArray(results[3]) ? results[3] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    month: status.month,
    summary,
    byCategory,
    byVendor,
  };
};
