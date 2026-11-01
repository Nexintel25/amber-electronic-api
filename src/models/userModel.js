import pool from "../config/db.js";
import { mapResultSets, decimalsToNumbers } from "../utils/dbResults.js";

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

// Calls sp_create_complaint (18 params, with subcategory + contact designation).
// Result set 1: { error_code, error_message, complaint_id, complaint_no }
// Result set 2 (only on success): created complaint details
// Result set 3 (only on success): push recipients { notification_id, user_id, message, fcm_token }
export const createComplaint = async ({
  userId,
  buildingId,
  categoryId,
  subcategoryId,
  complaintTypeId,
  title,
  description,
  areaLocation,
  assetCode,
  preferredVisit,
  latitude,
  longitude,
  locationAccuracy,
  contactName,
  contactPhone,
  contactDesignation,
  media,
  isDraft,
}) => {
  const [results] = await pool.query(
    "CALL sp_create_complaint(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      buildingId ?? null,
      categoryId ?? null,
      subcategoryId ?? null,
      complaintTypeId ?? null,
      title ?? null,
      description ?? null,
      areaLocation ?? null,
      assetCode ?? null,
      preferredVisit ?? null,
      latitude ?? null,
      longitude ?? null,
      locationAccuracy ?? null,
      contactName ?? null,
      contactPhone ?? null,
      contactDesignation ?? null,
      // SP expects a JSON array like [{ kind, file_url, ... }]; non-arrays are rejected by SP (1513)
      // form-data sends it as a string already, so pass strings through as-is
      media == null
        ? null
        : typeof media === "string"
          ? media
          : JSON.stringify(media),
      isDraft ? 1 : 0,
    ]
  );

  const status = results[0][0];
  const complaint = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const pushRecipients = Array.isArray(results[2]) ? results[2] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data: complaint,
    pushRecipients,
  };
};

// Known result sets of sp_create_client_org, in order, after the status row.
// Not named yet, so every result set comes back as section_<n> until it is listed here.
const CLIENT_ORG_SECTIONS = [];

// Calls sp_create_client_org (super admin only).
// Creates one building per name in p_buildings (codes <prefix>-01, <prefix>-02 ...),
// maps them to the vendor (if given) and creates the client creator + client admin users.
// Result set 1: { error_code, error_message, ... }
// Every status column except the code / message and every result set after it is
// returned in data, so whatever the SP adds shows up without a code change.
export const createClientOrg = async ({
  createdBy,
  codePrefix,
  city,
  vendorId,
  buildings,
  creatorName,
  creatorEmail,
  creatorPhone,
  creatorHash,
  adminName,
  adminEmail,
  adminPhone,
  adminHash,
}) => {
  const [results, fields] = await pool.query(
    "CALL sp_create_client_org(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      createdBy ?? null,
      codePrefix ?? null,
      city ?? null,
      vendorId ?? null, // NULL -> buildings are not mapped to any vendor
      // SP expects a JSON array of building names like ["Tower-A","Basement-1"]
      // form-data sends it as a string already, so pass strings through as-is
      buildings == null
        ? null
        : typeof buildings === "string"
          ? buildings
          : JSON.stringify(buildings),
      creatorName ?? null,
      creatorEmail ?? null,
      creatorPhone ?? null,
      creatorHash ?? null,
      adminName ?? null,
      adminEmail ?? null,
      adminPhone ?? null,
      adminHash ?? null,
    ]
  );

  const [status] = decimalsToNumbers(results[0], fields[0]);
  const { error_code, error_message, ...extraStatus } = status;

  return {
    code: error_code,
    message: error_message,
    data:
      error_code === 0
        ? { ...extraStatus, ...mapResultSets(results, fields, CLIENT_ORG_SECTIONS) }
        : null,
  };
};
