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
