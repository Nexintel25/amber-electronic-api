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
// export const checkMedia = async ({ media, minPhotos }) => {
//   const conn = await pool.getConnection();
//   try {
//     await conn.query("CALL sp_internal_check_media(?, ?, @o_code, @o_msg)", [
//       // SP expects a JSON array like [{ kind, file_url }]; non-arrays are rejected by SP (1616)
//       // form-data sends it as a string already, so pass strings through as-is
//       media == null
//         ? null
//         : typeof media === "string"
//           ? media
//           : JSON.stringify(media),
//       minPhotos ?? 0,
//     ]);

//     const [[status]] = await conn.query("SELECT @o_code AS code, @o_msg AS message");

//     return {
//       code: status.code,
//       message: status.message,
//     };
//   } finally {
//     conn.release();
//   }
// };

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

// Calls sp_vendor_approve (closes the complaint, levies the SLA fine if late).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): { complaint_id, complaint_no, status, closed_at, closed_on_time, fine_amount }
// Result set 3 (only on success): push recipients { notification_id, user_id, event_type, message, fcm_token }
export const vendorApprove = async ({ userId, complaintId, remarks }) => {
  const [results] = await pool.query("CALL sp_vendor_approve(?, ?, ?)", [
    userId ?? null,
    complaintId ?? null,
    remarks ?? null,
  ]);

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

// Calls sp_vendor_rework (sends PENDING_APPROVAL work back as REWORK_REQUIRED).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): { complaint_id, complaint_no, status, rework_count, worker_id, worker_name }
// Result set 3 (only on success): push recipients { notification_id, user_id, event_type, message, fcm_token }
export const vendorRework = async ({ userId, complaintId, reason, workerId }) => {
  const [results] = await pool.query("CALL sp_vendor_rework(?, ?, ?, ?)", [
    userId ?? null,
    complaintId ?? null,
    reason ?? null,
    workerId ?? null,
  ]);

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

// Calls sp_report_filter_options.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): report types { code, name, hint }
// Result set 3 (only on success): vendors the user may filter by { vendor_id, company_name }
export const getReportFilterOptions = async ({ userId }) => {
  const [results] = await pool.query("CALL sp_report_filter_options(?)", [
    userId ?? null,
  ]);

  const status = results[0][0];
  const rows = (i) => (Array.isArray(results[i]) ? results[i] : []);

  const data =
    status.error_code === 0
      ? { report_types: rows(1), vendors: rows(2) }
      : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_penalty_report.
// Result set 1: { error_code, error_message, total_count }
// Result set 2 (only on success): summary of the whole filtered set (single row)
// Result set 3 (only on success): vendor wise summary
// Result set 4 (only on success): one page of rows (all rows, max 50000, when export = 1)
export const getPenaltyReport = async ({
  userId,
  reportType,
  fromDate,
  toDate,
  dateBy,
  vendorId,
  search,
  page,
  limit,
  isExport,
}) => {
  const [results] = await pool.query(
    "CALL sp_penalty_report(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      reportType ?? null,
      fromDate ?? null,
      toDate ?? null,
      dateBy ?? null,
      vendorId ?? null,
      search ?? null,
      page,
      limit,
      isExport ? 1 : 0,
    ]
  );

  const statusRow = results[0][0];
  const rows = (i) => (Array.isArray(results[i]) ? results[i] : []);

  // SUM() counts come back as DECIMAL strings, so convert them to numbers
  const summaryRow = rows(1)[0] ?? null;
  const summary = summaryRow
    ? {
        ...summaryRow,
        levied_count: Number(summaryRow.levied_count),
        accruing_count: Number(summaryRow.accruing_count),
        waived_count: Number(summaryRow.waived_count),
      }
    : null;

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    total: statusRow.total_count,
    summary,
    vendorSummary: rows(2),
    data: rows(3),
  };
};
