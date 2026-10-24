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

// Calls sp_internal_check_media.
// No result sets: the result comes back through OUT params o_code / o_msg,
// so the CALL and the SELECT of the session variables must use the same connection.
export const checkMedia = async ({ media, minPhotos }) => {
  const conn = await pool.getConnection();
  try {
    await conn.query("CALL sp_internal_check_media(?, ?, @o_code, @o_msg)", [
      // SP expects a JSON array like [{ kind, file_url }]; non-arrays are rejected by SP (1616)
      // form-data sends it as a string already, so pass strings through as-is
      media == null
        ? null
        : typeof media === "string"
          ? media
          : JSON.stringify(media),
      minPhotos ?? 0,
    ]);

    const [[status]] = await conn.query("SELECT @o_code AS code, @o_msg AS message");

    return {
      code: status.code,
      message: status.message,
    };
  } finally {
    conn.release();
  }
};

// Calls sp_admin_dashboard.
// Result set 1: { error_code, error_message }
// Result sets 2-9 (only on success), in order:
//   2 kpis (single row), 3 status pipeline, 4 worker live tracking,
//   5 open complaints with GPS, 6 activity feed, 7 raised vs resolved (last 14 days),
//   8 by category, 9 site-wise status
export const getAdminDashboard = async ({ userId }) => {
  const [results] = await pool.query("CALL sp_admin_dashboard(?)", [
    userId ?? null,
  ]);

  const status = results[0][0];
  const rows = (i) => (Array.isArray(results[i]) ? results[i] : []);

  const data =
    status.error_code === 0
      ? {
          kpis: rows(1)[0] ?? null,
          pipeline: rows(2),
          workers: rows(3),
          map_complaints: rows(4),
          activity: rows(5),
          trend: rows(6),
          categories: rows(7),
          sites: rows(8),
        }
      : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_pm_dashboard (project managers only).
// Result set 1: { error_code, error_message }
// Result sets 2-7 (only on success), in order:
//   2 kpis (single row), 3 vendor scorecard, 4 needs a nudge (oldest open complaints),
//   5 workers in the field, 6 open complaints with GPS, 7 my buildings
export const getPmDashboard = async ({ userId }) => {
  const [results] = await pool.query("CALL sp_pm_dashboard(?)", [
    userId ?? null,
  ]);

  const status = results[0][0];
  const rows = (i) => (Array.isArray(results[i]) ? results[i] : []);

  const data =
    status.error_code === 0
      ? {
          kpis: rows(1)[0] ?? null,
          vendors: rows(2),
          needs_nudge: rows(3),
          workers: rows(4),
          map_complaints: rows(5),
          buildings: rows(6),
        }
      : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_pm_vendors (project managers only).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): vendor rows of the PM with scorecard numbers
export const getPmVendors = async ({ userId, onlyActive }) => {
  const [results] = await pool.query("CALL sp_pm_vendors(?, ?)", [
    userId ?? null,
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

// Calls sp_creator_dashboard (clients only).
// Result set 1: { error_code, error_message }
// Result sets 2-4 (only on success), in order:
//   2 kpis (single row), 3 SLA compliance card (single row), 4 active complaints
export const getCreatorDashboard = async ({ userId, onlyMine, activeLimit }) => {
  const [results] = await pool.query("CALL sp_creator_dashboard(?, ?, ?)", [
    userId ?? null,
    onlyMine ? 1 : 0,
    activeLimit ?? null,
  ]);

  const status = results[0][0];
  const rows = (i) => (Array.isArray(results[i]) ? results[i] : []);

  const data =
    status.error_code === 0
      ? {
          kpis: rows(1)[0] ?? null,
          sla: rows(2)[0] ?? null,
          active_complaints: rows(3),
        }
      : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_pm_worker_detail (project managers only).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): worker detail row
export const getPmWorkerDetail = async ({ userId, workerId }) => {
  const [results] = await pool.query("CALL sp_pm_worker_detail(?, ?)", [
    userId ?? null,
    workerId ?? null,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_set_pm_vendors.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success, if the SP returns it): vendors now mapped to the PM
export const setPmVendors = async ({ userId, pmId, vendorIds }) => {
  const [results] = await pool.query("CALL sp_set_pm_vendors(?, ?, ?)", [
    userId ?? null,
    pmId ?? null,
    // SP expects a JSON array like [1,2,3]; non-arrays are rejected by SP
    vendorIds == null
      ? null
      : typeof vendorIds === "string"
        ? vendorIds
        : JSON.stringify(vendorIds),
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};
