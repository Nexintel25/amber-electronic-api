import bcrypt from "bcryptjs";
import {
  createBuildingWithUser,
  // checkMedia as checkMediaModel,
  getAdminDashboard as getAdminDashboardModel,
  getPmDashboard as getPmDashboardModel,
  getPmVendors as getPmVendorsModel,
  getPmWorkerDetail as getPmWorkerDetailModel,
  setPmVendors as setPmVendorsModel,
  vendorApprove as vendorApproveModel,
  vendorRework as vendorReworkModel,
  getReportFilterOptions as getReportFilterOptionsModel,
  getPenaltyReport as getPenaltyReportModel,
} from "../models/buildingModel.js";

// SP error code -> HTTP status
const STATUS_BY_CODE = {
  0: 200,
  1101: 400, // Building name is required
  1102: 403, // Only super admin can create a building
  1103: 409, // Building code already exists
  1104: 400, // User name is required
  1105: 400, // Valid email is required
  1106: 409, // Email already exists
  1107: 400, // Password hash is required
  1108: 404, // Vendor not found or inactive
  1109: 404, // Creator not found or inactive
  5000: 500, // Database error
};

export const createBuilding = async (req, res) => {
  try {
    const {
      building_name,
      building_code,
      address,
      city,
      sla_enabled,
      user_name,
      user_email,
      user_phone,
      password,
      vendor_id,
    } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const createdBy = req.user?.id ?? req.body.created_by;

    if (!password) {
      return res
        .status(400)
        .json({ success: false, code: 1107, message: "Password is required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await createBuildingWithUser({
      buildingName: building_name,
      buildingCode: building_code,
      address,
      city,
      slaEnabled: sla_enabled,
      userName: user_name,
      userEmail: user_email,
      userPhone: user_phone,
      passwordHash,
      vendorId: vendor_id,
      createdBy,
    });

    return res.status(STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("createBuilding error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_internal_check_media error code -> HTTP status
const CHECK_MEDIA_STATUS_BY_CODE = {
  0: 200,
  1612: 400, // At least N photos are required
  1613: 400, // Invalid media (kind / file_url)
  1614: 400, // Maximum 10 photos allowed
  1615: 400, // Maximum 2 videos allowed
  1616: 400, // media must be a JSON array
};

// export const checkMedia = async (req, res) => {
//   try {
//     const { media, min_photos } = req.body;

//     const result = await checkMediaModel({
//       media,
//       minPhotos: Number(min_photos) || 0,
//     });

//     return res.status(CHECK_MEDIA_STATUS_BY_CODE[result.code] ?? 400).json({
//       success: result.code === 0,
//       code: result.code,
//       message: result.message,
//     });
//   } catch (err) {
//     console.error("checkMedia error:", err);
//     return res
//       .status(500)
//       .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
//   }
// };

// sp_admin_dashboard error code -> HTTP status
const ADMIN_DASHBOARD_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this
  5000: 500, // Database error
};

export const getAdminDashboard = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getAdminDashboardModel({ userId });

    return res.status(ADMIN_DASHBOARD_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getAdminDashboard error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_pm_dashboard error code -> HTTP status
const PM_DASHBOARD_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this (project managers only)
  5000: 500, // Database error
};

export const getPmDashboard = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getPmDashboardModel({ userId });

    return res.status(PM_DASHBOARD_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getPmDashboard error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_pm_vendors error code -> HTTP status
const PM_VENDORS_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this (project managers only)
  5000: 500, // Database error
};

export const getPmVendors = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // SP default is all vendors, so only 1 / "1" / true / "true" filters to active ones
    const onlyActive =
      input.only_active === 1 ||
      input.only_active === true ||
      input.only_active === "1" ||
      input.only_active === "true";

    const result = await getPmVendorsModel({ userId, onlyActive });

    return res.status(PM_VENDORS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getPmVendors error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_pm_worker_detail / sp_set_pm_vendors: only 0 and 5000 are known here,
// any other SP error code falls back to 400
const PM_COMMON_STATUS_BY_CODE = {
  0: 200,
  5000: 500, // Database error
};

export const getPmWorkerDetail = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getPmWorkerDetailModel({
      userId,
      workerId: input.worker_id,
    });

    return res.status(PM_COMMON_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getPmWorkerDetail error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

export const setPmVendors = async (req, res) => {
  try {
    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await setPmVendorsModel({
      userId,
      pmId: req.body.pm_id,
      vendorIds: req.body.vendor_ids,
    });

    return res.status(PM_COMMON_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("setPmVendors error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_vendor_approve error code -> HTTP status
const VENDOR_APPROVE_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1602: 404, // Complaint not found or you do not have access
  1603: 403, // Only the vendor can approve the work
  1605: 409, // Complaint is not PENDING_APPROVAL / changed by someone else
  5000: 500, // Database error
};

export const vendorApprove = async (req, res) => {
  try {
    const { complaint_id, remarks } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await vendorApproveModel({
      userId,
      complaintId: complaint_id,
      remarks,
    });

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(VENDOR_APPROVE_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("vendorApprove error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_vendor_rework error code -> HTTP status
const VENDOR_REWORK_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1602: 404, // Complaint not found or you do not have access
  1603: 403, // Only the vendor can send the work back for rework
  1605: 409, // Complaint is not PENDING_APPROVAL / changed by someone else
  1606: 404, // Worker not found, inactive, or not under this vendor
  1901: 400, // Rework reason is required
  5000: 500, // Database error
};

export const vendorRework = async (req, res) => {
  try {
    const { complaint_id, reason, worker_id } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    // worker_id is optional: missing -> same worker gets the rework
    const result = await vendorReworkModel({
      userId,
      complaintId: complaint_id,
      reason,
      workerId: worker_id,
    });

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(VENDOR_REWORK_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("vendorRework error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_report_filter_options error code -> HTTP status
const REPORT_FILTER_OPTIONS_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this
  5000: 500, // Database error
};

export const getReportFilterOptions = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getReportFilterOptionsModel({ userId });

    return res
      .status(REPORT_FILTER_OPTIONS_STATUS_BY_CODE[result.code] ?? 400)
      .json({
        success: result.code === 0,
        code: result.code,
        message: result.message,
        data: result.data,
      });
  } catch (err) {
    console.error("getReportFilterOptions error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_penalty_report error code -> HTTP status
const PENALTY_REPORT_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this
  2001: 400, // Invalid report type
  2002: 400, // From date is after To date
  2003: 403, // Vendor is not allowed for you
  2004: 400, // Invalid date_by (raised / closed / deadline)
  5000: 500, // Database error
};

export const getPenaltyReport = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // same defaults as the SP: page >= 1, limit 1..100 (default 20)
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), 100);

    // export: 1 / "1" / true / "true" -> all rows (max 50000), no paging
    const isExport =
      input.export === 1 ||
      input.export === true ||
      input.export === "1" ||
      input.export === "true";

    const result = await getPenaltyReportModel({
      userId,
      reportType: input.report_type,
      fromDate: input.from_date, // "YYYY-MM-DD"
      toDate: input.to_date, // "YYYY-MM-DD"
      dateBy: input.date_by,
      vendorId: input.vendor_id,
      search: input.search,
      page,
      limit,
      isExport,
    });

    return res.status(PENALTY_REPORT_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      summary: result.summary,
      vendor_summary: result.vendorSummary,
      data: result.data,
      pagination: isExport
        ? null
        : {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
    });
  } catch (err) {
    console.error("getPenaltyReport error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
