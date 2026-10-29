import pool from "../config/db.js";
import { withFileUrls } from "../config/s3.js";

// Calls sp_get_building_complaint_types.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): building row { building_id, building_name, sla_enabled, vendor_id, vendor_name }
// Result set 3 (only on success): complaint type rows with SLA details for the building
export const getBuildingComplaintTypes = async ({ userId, buildingId }) => {
  const [results] = await pool.query(
    "CALL sp_get_building_complaint_types(?, ?)",
    [userId ?? null, buildingId ?? null]
  );

  const status = results[0][0];
  const data =
    status.error_code === 0
      ? {
          building: results[1][0] ?? null,
          complaint_types: Array.isArray(results[2]) ? results[2] : [],
        }
      : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_get_complaint_categories.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): category rows { id, code, name, icon }
export const getComplaintCategories = async ({ onlyActive }) => {
  const [results] = await pool.query("CALL sp_get_complaint_categories(?)", [
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

// Calls sp_get_complaints.
// Result set 1: { error_code, error_message, total_count }
// Result set 2 (only on success): one page of complaint rows visible to the user (role based)
export const getComplaints = async ({
  userId,
  status,
  buildingId,
  search,
  page,
  limit,
}) => {
  const [results] = await pool.query("CALL sp_get_complaints(?, ?, ?, ?, ?, ?)", [
    userId ?? null,
    status ?? null,
    buildingId ?? null,
    search ?? null,
    page,
    limit,
  ]);

  const statusRow = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    total: statusRow.total_count,
    data,
  };
};

// Calls sp_get_complaint_detail.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): complaint details
// Result set 3 (only on success): media rows
// Result set 4 (only on success): status history rows
export const getComplaintDetail = async ({ userId, complaintId }) => {
  const [results] = await pool.query("CALL sp_get_complaint_detail(?, ?)", [
    userId ?? null,
    complaintId ?? null,
  ]);

  const status = results[0][0];
  const complaint = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  // file_url holds the S3 key; swap it for a signed URL the frontend can show
  const media = await withFileUrls(Array.isArray(results[2]) ? results[2] : []);
  const history = Array.isArray(results[3]) ? results[3] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data: complaint ? { ...complaint, media, history } : null,
  };
};

// Calls sp_get_vendor_workers.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): active worker rows of the vendor with open_jobs count
export const getVendorWorkers = async ({ userId, vendorId }) => {
  const [results] = await pool.query("CALL sp_get_vendor_workers(?, ?)", [
    userId ?? null,
    vendorId ?? null,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_assign_worker.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): { complaint_id, complaint_no, status, worker_id, worker_name, worker_phone, assigned_at }
// Result set 3 (only on success): push recipients { notification_id, user_id, event_type, message, fcm_token }
export const assignWorker = async ({ userId, complaintId, workerId, remarks }) => {
  const [results] = await pool.query("CALL sp_assign_worker(?, ?, ?, ?)", [
    userId ?? null,
    complaintId ?? null,
    workerId ?? null,
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

// Calls sp_worker_checkin.
// Result set 1: { error_code, error_message, distance_m, geofence_radius_m }
// (no other result sets; distance_m / geofence_radius_m are also filled on 1609 = outside geofence)
export const workerCheckin = async ({
  userId,
  complaintId,
  latitude,
  longitude,
  accuracyM,
}) => {
  const [results] = await pool.query("CALL sp_worker_checkin(?, ?, ?, ?, ?)", [
    userId ?? null,
    complaintId ?? null,
    latitude ?? null,
    longitude ?? null,
    accuracyM ?? null,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    data: {
      distance_m: status.distance_m,
      geofence_radius_m: status.geofence_radius_m,
    },
  };
};

// Calls sp_worker_start.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): { complaint_id, complaint_no, status, started_at }
// Media is validated by sp_internal_check_media with min 2 photos (codes 1612-1616)
export const workerStart = async ({ userId, complaintId, media }) => {
  const [results] = await pool.query("CALL sp_worker_start(?, ?, ?)", [
    userId ?? null,
    complaintId ?? null,
    // SP expects a JSON array like [{ kind, file_url, ... }]; non-arrays are rejected by SP (1616)
    // form-data sends it as a string already, so pass strings through as-is
    media == null
      ? null
      : typeof media === "string"
        ? media
        : JSON.stringify(media),
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_worker_submit.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): { complaint_id, complaint_no, status, submitted_at }
// Result set 3 (only on success): push recipients { notification_id, user_id, event_type, message, fcm_token }
// Media is validated by sp_internal_check_media with min 2 photos (codes 1612-1616)
export const workerSubmit = async ({ userId, complaintId, note, media }) => {
  const [results] = await pool.query("CALL sp_worker_submit(?, ?, ?, ?)", [
    userId ?? null,
    complaintId ?? null,
    note ?? null,
    // SP expects a JSON array like [{ kind, file_url, ... }]; non-arrays are rejected by SP (1616)
    // form-data sends it as a string already, so pass strings through as-is
    media == null
      ? null
      : typeof media === "string"
        ? media
        : JSON.stringify(media),
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

// Calls sp_vendor_verification_list (vendors only).
// Result set 1: { error_code, error_message, total_count }
// Result set 2 (only on success): tab counts { pending_count, rework_count }
// Result set 3 (only on success): one page of complaint rows
// Result set 4 (only on success): photos of those complaints (initial + current cycle before/after)
export const getVendorVerificationList = async ({
  userId,
  view,
  search,
  buildingId,
  workerId,
  page,
  limit,
}) => {
  const [results] = await pool.query(
    "CALL sp_vendor_verification_list(?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      view ?? null,
      search ?? null,
      buildingId ?? null,
      workerId ?? null,
      page,
      limit,
    ]
  );

  const statusRow = results[0][0];
  // SUM() comes back as a DECIMAL string, so convert the tab counts to numbers
  const tabRow = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const tabs = tabRow
    ? {
        pending_count: Number(tabRow.pending_count),
        rework_count: Number(tabRow.rework_count),
      }
    : null;
  const complaints = Array.isArray(results[2]) ? results[2] : [];
  // file_url holds the S3 key; swap it for a signed URL the frontend can show
  const media = await withFileUrls(Array.isArray(results[3]) ? results[3] : []);

  // attach each complaint's photos to it
  const data = complaints.map((c) => ({
    ...c,
    media: media.filter((m) => m.complaint_id === c.complaint_id),
  }));

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    total: statusRow.total_count,
    tabs,
    data,
  };
};

// Calls sp_create_support_ticket.
// Result set 1: { error_code, error_message, ticket_id, ticket_no }
// Result set 2 (only on success): created ticket row
// Result set 3 (only on success): push recipients (super admins) { notification_id, user_id, event_type, message, fcm_token }
export const createSupportTicket = async ({
  userId,
  subject,
  area,
  severity,
  details,
  contactName,
  contactPhone,
}) => {
  const [results] = await pool.query(
    "CALL sp_create_support_ticket(?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      subject ?? null,
      area ?? null,
      severity ?? null,
      details ?? null,
      contactName ?? null,
      contactPhone ?? null,
    ]
  );

  const status = results[0][0];
  const ticket = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const pushRecipients = Array.isArray(results[2]) ? results[2] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data: ticket,
    pushRecipients,
  };
};

// Calls sp_get_my_tickets.
// Result set 1: { error_code, error_message, total_count }
// Result set 2 (only on success): tab counts { open_count, in_progress_count, resolved_count }
// Result set 3 (only on success): one page of the user's support tickets
export const getMyTickets = async ({ userId, status, page, limit }) => {
  const [results] = await pool.query("CALL sp_get_my_tickets(?, ?, ?, ?)", [
    userId ?? null,
    status ?? null,
    page,
    limit,
  ]);

  const statusRow = results[0][0];

  // SUM() comes back as a DECIMAL string, so convert the tab counts to numbers
  const tabRow = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const tabs = tabRow
    ? {
        open_count: Number(tabRow.open_count),
        in_progress_count: Number(tabRow.in_progress_count),
        resolved_count: Number(tabRow.resolved_count),
      }
    : null;

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    total: statusRow.total_count,
    tabs,
    data: Array.isArray(results[2]) ? results[2] : [],
  };
};

// Calls sp_admin_get_tickets (super admin only).
// Result set 1: { error_code, error_message, total_count }
// Result set 2 (only on success): tab counts (every filter except status)
// Result set 3 (only on success): one page of tickets, unresolved first, critical first
export const adminGetTickets = async ({
  userId,
  status,
  severity,
  area,
  search,
  fromDate,
  toDate,
  page,
  limit,
}) => {
  const [results] = await pool.query(
    "CALL sp_admin_get_tickets(?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      status ?? null,
      severity ?? null,
      area ?? null,
      search ?? null,
      fromDate ?? null,
      toDate ?? null,
      page,
      limit,
    ]
  );

  const statusRow = results[0][0];

  // SUM() comes back as a DECIMAL string, so convert the tab counts to numbers
  const tabRow = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const tabs = tabRow
    ? Object.fromEntries(Object.entries(tabRow).map(([k, v]) => [k, Number(v)]))
    : null;

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    total: statusRow.total_count,
    tabs,
    data: Array.isArray(results[2]) ? results[2] : [],
  };
};

// Calls sp_update_ticket_status (super admin only).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): updated ticket row
// Result set 3 (only on success): push recipients (ticket owner) { notification_id, user_id, event_type, message, fcm_token }
export const updateTicketStatus = async ({ userId, ticketId, status, note }) => {
  const [results] = await pool.query(
    "CALL sp_update_ticket_status(?, ?, ?, ?)",
    [userId ?? null, ticketId ?? null, status ?? null, note ?? null]
  );

  const statusRow = results[0][0];
  const ticket = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const pushRecipients = Array.isArray(results[2]) ? results[2] : [];

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    data: ticket,
    pushRecipients,
  };
};

// Calls sp_get_all_users.
// Result set 1: { error_code, error_message, total_count }
// Result set 2 (only on success): tab counts per role + active/inactive
// Result set 3 (only on success): one page of users
// Result set 4 (only on success): vendor filter options { vendor_id, company_name }
// Result set 5 (only on success): building filter options { building_id, building_name }
export const getAllUsers = async ({
  userId,
  role,
  status,
  vendorId,
  buildingId,
  search,
  page,
  limit,
}) => {
  const [results] = await pool.query(
    "CALL sp_get_all_users(?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      role ?? null,
      status ?? null,
      vendorId ?? null,
      buildingId ?? null,
      search ?? null,
      page,
      limit,
    ]
  );

  const statusRow = results[0][0];

  // SUM() comes back as a DECIMAL string, so convert the tab counts to numbers
  const tabRow = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const tabs = tabRow
    ? Object.fromEntries(Object.entries(tabRow).map(([k, v]) => [k, Number(v)]))
    : null;

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    total: Number(statusRow.total_count ?? 0),
    tabs,
    data: Array.isArray(results[2]) ? results[2] : [],
    filters: {
      vendors: Array.isArray(results[3]) ? results[3] : [],
      buildings: Array.isArray(results[4]) ? results[4] : [],
    },
  };
};
