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
} from "../models/complaintModel.js";

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

export const workerStart = async (req, res) => {
  try {
    const { complaint_id, media } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await workerStartModel({
      userId,
      complaintId: complaint_id,
      media,
    });

    return res.status(WORKER_START_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("workerStart error:", err);
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
  try {
    const { complaint_id, note, media } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await workerSubmitModel({
      userId,
      complaintId: complaint_id,
      note,
      media,
    });

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(WORKER_SUBMIT_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("workerSubmit error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
