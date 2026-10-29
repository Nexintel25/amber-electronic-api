import {
  getBuildingComplaintTypes as getBuildingComplaintTypesModel,
  getComplaintCategories as getComplaintCategoriesModel,
  getComplaints as getComplaintsModel,
  getComplaintDetail as getComplaintDetailModel,
  getVendorWorkers as getVendorWorkersModel,
  assignWorker as assignWorkerModel,
  workerCheckin as workerCheckinModel,
  workerStart as workerStartModel,
  workerSubmit as workerSubmitModel,
  getVendorVerificationList as getVendorVerificationListModel,
  createSupportTicket as createSupportTicketModel,
  getMyTickets as getMyTicketsModel,
  adminGetTickets as adminGetTicketsModel,
  updateTicketStatus as updateTicketStatusModel,
  getAllUsers as getAllUsersModel,
} from "../models/complaintModel.js";
import { uploadToS3, deleteFromS3, withFileUrls } from "../config/s3.js";

// sp_get_building_complaint_types error code -> HTTP status
const BUILDING_COMPLAINT_TYPES_STATUS_BY_CODE = {
  0: 200,
  1501: 404, // User not found or inactive
  1502: 403, // Role cannot raise complaints
  1503: 404, // Building not found or inactive
  1504: 403, // No access to this building
  5000: 500, // Database error
};

export const getBuildingComplaintTypes = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getBuildingComplaintTypesModel({
      userId,
      buildingId: input.building_id,
    });

    return res
      .status(BUILDING_COMPLAINT_TYPES_STATUS_BY_CODE[result.code] ?? 400)
      .json({
        success: result.code === 0,
        code: result.code,
        message: result.message,
        data: result.data,
      });
  } catch (err) {
    console.error("getBuildingComplaintTypes error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_complaint_categories error code -> HTTP status
const COMPLAINT_CATEGORIES_STATUS_BY_CODE = {
  0: 200,
  5000: 500, // Database error
};

// only_active: 0 / "0" / false / "false" -> all, anything else (or missing) -> only active
const parseOnlyActive = (value) =>
  !(value === 0 || value === false || value === "0" || value === "false");

export const getComplaintCategories = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    const result = await getComplaintCategoriesModel({
      onlyActive: parseOnlyActive(input.only_active),
    });

    return res
      .status(COMPLAINT_CATEGORIES_STATUS_BY_CODE[result.code] ?? 400)
      .json({
        success: result.code === 0,
        code: result.code,
        message: result.message,
        data: result.data,
      });
  } catch (err) {
    console.error("getComplaintCategories error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};


// sp_get_complaints error code -> HTTP status
const COMPLAINTS_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  5000: 500, // Database error
};

export const getComplaints = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // same defaults as the SP: page >= 1, limit 1..100 (default 20)
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), 100);

    const result = await getComplaintsModel({
      userId,
      status: input.status,
      buildingId: input.building_id,
      search: input.search,
      page,
      limit,
    });

    return res.status(COMPLAINTS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    console.error("getComplaints error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_complaint_detail error code -> HTTP status
const COMPLAINT_DETAIL_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1602: 404, // Complaint not found or you do not have access
  5000: 500, // Database error
};

export const getComplaintDetail = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getComplaintDetailModel({
      userId,
      complaintId: input.complaint_id,
    });

    return res.status(COMPLAINT_DETAIL_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getComplaintDetail error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_vendor_workers error code -> HTTP status
const VENDOR_WORKERS_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this
  1604: 404, // Vendor not found or inactive
  5000: 500, // Database error
};

export const getVendorWorkers = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // vendor users always get their own workers (SP ignores vendor_id for them)
    const result = await getVendorWorkersModel({
      userId,
      vendorId: input.vendor_id,
    });

    return res.status(VENDOR_WORKERS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getVendorWorkers error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_assign_worker error code -> HTTP status
const ASSIGN_WORKER_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1602: 404, // Complaint not found or you do not have access
  1603: 403, // Only the vendor can assign a worker
  1605: 409, // Complaint status does not allow assigning / changed by someone else
  1606: 404, // Worker not found, inactive, or not under this vendor
  1617: 409, // Complaint is already assigned to this worker
  5000: 500, // Database error
};

export const assignWorker = async (req, res) => {
  try {
    const { complaint_id, worker_id, remarks } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await assignWorkerModel({
      userId,
      complaintId: complaint_id,
      workerId: worker_id,
      remarks,
    });

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(ASSIGN_WORKER_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("assignWorker error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_worker_checkin error code -> HTTP status
const WORKER_CHECKIN_STATUS_BY_CODE = {
  0: 200, // Checked in successfully / Already checked in
  1601: 404, // User not found or inactive
  1603: 403, // Only a worker can check in
  1605: 409, // Complaint status does not allow check-in
  1607: 403, // This complaint is not assigned to you
  1608: 400, // GPS location is required
  1609: 400, // Outside the building geofence
  5000: 500, // Database error
};

export const workerCheckin = async (req, res) => {
  try {
    const { complaint_id, latitude, longitude, accuracy_m } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await workerCheckinModel({
      userId,
      complaintId: complaint_id,
      latitude,
      longitude,
      accuracyM: accuracy_m,
    });

    return res.status(WORKER_CHECKIN_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("workerCheckin error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_worker_start error code -> HTTP status
const WORKER_START_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Only a worker can start the work
  1605: 409, // Complaint status does not allow starting / changed by someone else
  1607: 403, // This complaint is not assigned to you
  1610: 409, // Check in at the site first
  1612: 400, // At least 2 photos are required
  1613: 400, // Invalid media (kind / file_url)
  1614: 400, // Maximum 10 photos allowed
  1615: 400, // Maximum 2 videos allowed
  1616: 400, // media must be a JSON array
  5000: 500, // Database error
};

// Uploads the form-data "media" files to S3 and builds the media JSON the SP expects.
// Keys are pushed into uploadedKeys as they finish, so the caller can clean them up on failure.
const uploadMediaFiles = (files, folder, uploadedKeys) =>
  Promise.all(
    files.map(async (file) => {
      const key = await uploadToS3(file, folder);
      uploadedKeys.push(key);
      return {
        kind: file.mimetype.startsWith("video/") ? "video" : "photo",
        file_url: key,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size_kb: Math.ceil(file.size / 1024),
      };
    })
  );

// Deletes uploaded files when the SP rejects the request, so S3 has no orphans
const cleanupUploads = (keys) =>
  deleteFromS3(keys).catch((err) => console.error("S3 cleanup error:", err));

export const workerStart = async (req, res) => {
  const uploadedKeys = [];
  try {
    const { complaint_id } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    // photos sent as form-data files go to S3; a JSON "media" array still works as before
    const uploaded = req.files?.length
      ? await uploadMediaFiles(
          req.files,
          `complaints/${parseInt(complaint_id, 10) || 0}/before`,
          uploadedKeys
        )
      : null;

    const result = await workerStartModel({
      userId,
      complaintId: complaint_id,
      media: uploaded ?? req.body.media,
    });

    if (result.code !== 0) await cleanupUploads(uploadedKeys);

    return res.status(WORKER_START_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data && {
        ...result.data,
        media: uploaded ? await withFileUrls(uploaded) : [],
      },
    });
  } catch (err) {
    console.error("workerStart error:", err);
    await cleanupUploads(uploadedKeys);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_worker_submit error code -> HTTP status
const WORKER_SUBMIT_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Only a worker can submit the work
  1605: 409, // Complaint is not IN_PROGRESS / changed by someone else
  1607: 403, // This complaint is not assigned to you
  1611: 409, // Save the Before photos first (minimum 2)
  1612: 400, // At least 2 photos are required
  1613: 400, // Invalid media (kind / file_url)
  1614: 400, // Maximum 10 photos allowed
  1615: 400, // Maximum 2 videos allowed
  1616: 400, // media must be a JSON array
  5000: 500, // Database error
};

export const workerSubmit = async (req, res) => {
  const uploadedKeys = [];
  try {
    const { complaint_id, note } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    // photos sent as form-data files go to S3; a JSON "media" array still works as before
    const uploaded = req.files?.length
      ? await uploadMediaFiles(
          req.files,
          `complaints/${parseInt(complaint_id, 10) || 0}/after`,
          uploadedKeys
        )
      : null;

    const result = await workerSubmitModel({
      userId,
      complaintId: complaint_id,
      note,
      media: uploaded ?? req.body.media,
    });

    if (result.code !== 0) await cleanupUploads(uploadedKeys);

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(WORKER_SUBMIT_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data && {
        ...result.data,
        media: uploaded ? await withFileUrls(uploaded) : [],
      },
    });
  } catch (err) {
    console.error("workerSubmit error:", err);
    await cleanupUploads(uploadedKeys);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_vendor_verification_list error code -> HTTP status
const VENDOR_VERIFICATION_LIST_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this (vendors only)
  1606: 404, // Worker not found, inactive, or not under this vendor
  1902: 400, // Invalid view (pending / rework / all)
  1903: 403, // Building is not under your vendor
  5000: 500, // Database error
};

export const getVendorVerificationList = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // same defaults as the SP: page >= 1, limit 1..100 (default 20); view defaults to "pending" in the SP
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), 100);

    const result = await getVendorVerificationListModel({
      userId,
      view: input.view,
      search: input.search,
      buildingId: input.building_id,
      workerId: input.worker_id,
      page,
      limit,
    });

    return res
      .status(VENDOR_VERIFICATION_LIST_STATUS_BY_CODE[result.code] ?? 400)
      .json({
        success: result.code === 0,
        code: result.code,
        message: result.message,
        tabs: result.tabs,
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
        },
      });
  } catch (err) {
    console.error("getVendorVerificationList error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_create_support_ticket error code -> HTTP status
const SUPPORT_TICKET_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  2101: 400, // Subject is required
  2102: 400, // Invalid area
  2103: 400, // Invalid severity
  2104: 400, // Contact number is required
  2105: 400, // Invalid contact number
  5000: 500, // Database error
};

export const createSupportTicket = async (req, res) => {
  try {
    const { subject, area, severity, details, contact_name, contact_phone } =
      req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    // area defaults to "web_dashboard", severity to "low", contact to the user's own name / phone (in the SP)
    const result = await createSupportTicketModel({
      userId,
      subject,
      area,
      severity,
      details,
      contactName: contact_name,
      contactPhone: contact_phone,
    });

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(SUPPORT_TICKET_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("createSupportTicket error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_my_tickets error code -> HTTP status
const MY_TICKETS_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  2108: 400, // Invalid status filter (all / open / in_progress / resolved)
  5000: 500, // Database error
};

export const getMyTickets = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // same defaults as the SP: page >= 1, limit 1..100 (default 10); status defaults to "all" in the SP
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 10, 1), 100);

    const result = await getMyTicketsModel({
      userId,
      status: input.status,
      page,
      limit,
    });

    return res.status(MY_TICKETS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      tabs: result.tabs,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    console.error("getMyTickets error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_admin_get_tickets error code -> HTTP status
const ADMIN_TICKETS_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Only super admin can view all support tickets
  2102: 400, // Invalid area
  2103: 400, // Invalid severity
  2108: 400, // Invalid status filter (pending / open / in_progress / resolved / all)
  2111: 400, // From date is after To date
  5000: 500, // Database error
};

export const adminGetTickets = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // same defaults as the SP: page >= 1, limit 1..100 (default 20); status defaults to "pending" in the SP
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), 100);

    const result = await adminGetTicketsModel({
      userId,
      status: input.status,
      severity: input.severity,
      area: input.area,
      search: input.search,
      fromDate: input.from_date, // "YYYY-MM-DD"
      toDate: input.to_date, // "YYYY-MM-DD"
      page,
      limit,
    });

    return res.status(ADMIN_TICKETS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      tabs: result.tabs,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    console.error("adminGetTickets error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_update_ticket_status error code -> HTTP status
const UPDATE_TICKET_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Only super admin can update a support ticket
  2106: 404, // Ticket not found
  2107: 409, // Ticket is already resolved / in that status / changed by someone else
  2109: 400, // Resolution note is required
  2110: 400, // Invalid status (in_progress / resolved)
  5000: 500, // Database error
};

export const updateTicketStatus = async (req, res) => {
  try {
    const { ticket_id, status, note } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await updateTicketStatusModel({
      userId,
      ticketId: ticket_id,
      status,
      note,
    });

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(UPDATE_TICKET_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("updateTicketStatus error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_all_users error code -> HTTP status
const ALL_USERS_STATUS_BY_CODE = {
  0: 200,
  1503: 404, // Building not found or inactive
  1601: 404, // User not found or inactive
  1603: 403, // Only super admin can view all users
  1604: 404, // Vendor not found
  2201: 400, // Invalid role filter
  2202: 400, // Invalid status filter (all / active / inactive)
  5000: 500, // Database error
};

export const getAllUsers = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // page >= 1, limit 1..100 (default 20)
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), 100);

    const result = await getAllUsersModel({
      userId,
      role: input.role,
      status: input.status,
      vendorId: input.vendor_id,
      buildingId: input.building_id,
      search: input.search,
      page,
      limit,
    });

    return res.status(ALL_USERS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      tabs: result.tabs,
      data: result.data,
      filters: result.filters,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
