import pool from "../config/db.js";

// Calls sp_create_building_with_user.
// Result set 1: { error_code, error_message, building_id, user_id }
// Result set 2 (only on success): building + user details
export const createBuildingWithUser = async ({
  buildingName,
  buildingCode,
  address,
  city,
  slaEnabled,
  userName,
  userEmail,
  userPhone,
  passwordHash,
  vendorId,
  createdBy,
}) => {
  const [results] = await pool.query(
    "CALL sp_create_building_with_user(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      buildingName ?? null,
      buildingCode ?? null,
      address ?? null,
      city ?? null,
      slaEnabled ? 1 : 0,
      userName ?? null,
      userEmail ?? null,
      userPhone ?? null,
      passwordHash ?? null,
      vendorId ?? null,
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
