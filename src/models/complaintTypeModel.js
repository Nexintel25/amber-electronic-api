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
