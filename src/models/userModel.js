import pool from "../config/db.js";

// Calls sp_create_user.
// Result set 1: { error_code, error_message, user_id }
// Result set 2 (only on success): created user row
export const createUser = async ({
  name,
  email,
  phone,
  passwordHash,
  role,
  vendorId,
  buildingId,
  createdBy,
}) => {
  const [results] = await pool.query(
    "CALL sp_create_user(?, ?, ?, ?, ?, ?, ?, ?)",
    [
      name ?? null,
      email ?? null,
      phone ?? null,
      passwordHash ?? null,
      role ?? null,
      vendorId ?? null,
      buildingId ?? null,
      createdBy ?? null,
    ]
  );

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};
