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

// Calls sp_create_vendor.
// Result set 1: { error_code, error_message, vendor_id, user_id }
// Result set 2 (only on success): vendor + vendor user details
// Result set 3 (only on success): buildings assigned to the vendor
export const createVendor = async ({
  companyName,
  contactPhone,
  userName,
  userEmail,
  passwordHash,
  buildingIds,
  createdBy,
}) => {
  const [results] = await pool.query(
    "CALL sp_create_vendor(?, ?, ?, ?, ?, ?, ?)",
    [
      companyName ?? null,
      contactPhone ?? null,
      userName ?? null,
      userEmail ?? null,
      passwordHash ?? null,
      // SP expects a JSON array like [1,2,3]; non-arrays are rejected by SP (1210)
      buildingIds == null ? null : JSON.stringify(buildingIds),
      createdBy ?? null,
    ]
  );

  const status = results[0][0];
  const vendor = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const buildings = Array.isArray(results[2]) ? results[2] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data: vendor ? { ...vendor, buildings } : null,
  };
};
