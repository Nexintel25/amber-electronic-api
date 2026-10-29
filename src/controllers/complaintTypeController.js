import {
  getComplaintTypes as getComplaintTypesModel,
  getBuildings as getBuildingsModel,
  getVendors as getVendorsModel,
  getUserTypes as getUserTypesModel,
  getBenchmarkReport as getBenchmarkReportModel,
  recordComplaintFeedback as recordComplaintFeedbackModel,
  setComplianceRule as setComplianceRuleModel,
  getComplaintRegisterReport as getComplaintRegisterReportModel,
  getSatisfactionReport as getSatisfactionReportModel,
  waiveFine as waiveFineModel,
} from "../models/complaintTypeModel.js";

// SP error code -> HTTP status
const STATUS_BY_CODE = {
  0: 200,
  5000: 500, // Database error
};

// only_active: 0 / "0" / false / "false" -> all, anything else (or missing) -> only active
const parseOnlyActive = (value) =>
  !(value === 0 || value === false || value === "0" || value === "false");

export const getComplaintTypes = async (req, res) => {
  try {
    const onlyActive = parseOnlyActive(
      req.body?.only_active ?? req.query.only_active
    );

    const result = await getComplaintTypesModel({ onlyActive });

    return res.status(STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getComplaintTypes error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_buildings error code -> HTTP status
const BUILDINGS_STATUS_BY_CODE = {
  0: 200,
  1301: 404, // User not found or inactive
  1302: 403, // Role not allowed
  5000: 500, // Database error
};

export const getBuildings = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getBuildingsModel({
      userId,
      onlyActive: parseOnlyActive(input.only_active),
      search: input.search,
    });

    return res.status(BUILDINGS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getBuildings error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_vendors uses the same codes as sp_get_buildings (1301, 1302, 5000)
export const getVendors = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getVendorsModel({
      userId,
      onlyActive: parseOnlyActive(input.only_active),
      search: input.search,
    });

    return res.status(BUILDINGS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getVendors error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_user_types uses the same codes as sp_get_complaint_types (0, 5000)
export const getUserTypes = async (req, res) => {
  try {
    const onlyActive = parseOnlyActive(
      req.body?.only_active ?? req.query.only_active
    );

    const result = await getUserTypesModel({ onlyActive });

    return res.status(STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getUserTypes error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_report_benchmark error code -> HTTP status (codes come from sp_cmp_prepare)
const BENCHMARK_REPORT_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this
  2301: 400, // Invalid month, use YYYY-MM
  2302: 403, // Vendor is not allowed for you
  5000: 500, // Database error
};

export const getBenchmarkReport = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getBenchmarkReportModel({
      userId,
      month: input.month, // "YYYY-MM", missing -> current month
      // "" / "null" from the UI means all vendors; the SP param is INT so send NULL
      vendorId: parseInt(input.vendor_id, 10) || null,
    });

    return res.status(BENCHMARK_REPORT_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      month: result.month,
      summary: result.summary,
      by_category: result.byCategory,
      by_vendor: result.byVendor,
    });
  } catch (err) {
    console.error("getBenchmarkReport error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_record_complaint_feedback error code -> HTTP status
const COMPLAINT_FEEDBACK_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this (client / admin / super_admin only)
  2401: 404, // Complaint not found
  2402: 409, // Feedback can be taken only on a CLOSED complaint
  2403: 400, // satisfied must be 0 or 1
  2407: 403, // You can give feedback only on complaints of your own building
  5000: 500, // Database error
};

// satisfied: 1 / "1" / true / "true" -> 1, 0 / "0" / false / "false" -> 0,
// anything else -> null so the SP rejects it (2403)
const parseSatisfied = (value) => {
  if (value === 1 || value === true || value === "1" || value === "true") return 1;
  if (value === 0 || value === false || value === "0" || value === "false") return 0;
  return null;
};

export const recordComplaintFeedback = async (req, res) => {
  try {
    const { complaint_id, satisfied, remarks } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await recordComplaintFeedbackModel({
      userId,
      complaintId: complaint_id,
      satisfied: parseSatisfied(satisfied),
      remarks,
    });

    return res.status(COMPLAINT_FEEDBACK_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("recordComplaintFeedback error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_set_compliance_rule error code -> HTTP status
const COMPLIANCE_RULE_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this (super_admin only)
  2404: 400, // Invalid rule_type (timeliness / satisfaction)
  2405: 400, // Invalid percentage / amount (tier 2 % must not be above tier 1 %)
  2406: 404, // Category not found
  5000: 500, // Database error
};

// "" / "abc" / missing -> null so the SP rejects it (2405) instead of a MySQL type error
const parseNumber = (value) => {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
};

export const setComplianceRule = async (req, res) => {
  try {
    const {
      category_id,
      rule_type,
      tier1_pct,
      tier1_amount,
      tier2_pct,
      tier2_amount,
    } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await setComplianceRuleModel({
      userId,
      categoryId: parseInt(category_id, 10) || null,
      ruleType: rule_type,
      tier1Pct: parseNumber(tier1_pct),
      tier1Amount: parseNumber(tier1_amount),
      tier2Pct: parseNumber(tier2_pct),
      tier2Amount: parseNumber(tier2_amount),
    });

    return res.status(COMPLIANCE_RULE_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
    });
  } catch (err) {
    console.error("setComplianceRule error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_report_complaint_register error code -> HTTP status (codes come from sp_cmp_prepare)
const COMPLAINT_REGISTER_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this
  2301: 400, // Invalid month, use YYYY-MM
  2302: 403, // Vendor is not allowed for you
  5000: 500, // Database error
};

export const getComplaintRegisterReport = async (req, res) => {
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

    const result = await getComplaintRegisterReportModel({
      userId,
      month: input.month, // "YYYY-MM", missing -> current month
      // "" / "null" from the UI means all; the SP params are INT so send NULL
      vendorId: parseInt(input.vendor_id, 10) || null,
      categoryId: parseInt(input.category_id, 10) || null,
      status: input.status, // e.g. CLOSED, missing / "ALL" -> all statuses
      search: input.search,
      page,
      limit,
      isExport,
    });

    return res.status(COMPLAINT_REGISTER_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      month: result.month,
      summary: result.summary,
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
    console.error("getComplaintRegisterReport error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_report_satisfaction uses the same codes as sp_report_benchmark (from sp_cmp_prepare)
export const getSatisfactionReport = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getSatisfactionReportModel({
      userId,
      month: input.month, // "YYYY-MM", missing -> current month
      // "" / "null" from the UI means all vendors; the SP param is INT so send NULL
      vendorId: parseInt(input.vendor_id, 10) || null,
    });

    return res.status(BENCHMARK_REPORT_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      month: result.month,
      summary: result.summary,
      by_vendor: result.byVendor,
      feedbacks: result.feedbacks,
    });
  } catch (err) {
    console.error("getSatisfactionReport error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_waive_fine error code -> HTTP status
const WAIVE_FINE_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this (admin / super_admin only)
  2501: 404, // No fine found for this complaint
  2502: 409, // Fine is already waived
  2503: 400, // Remarks are required
  5000: 500, // Database error
};

export const waiveFine = async (req, res) => {
  try {
    const { complaint_id, remarks } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    const result = await waiveFineModel({
      userId,
      complaintId: complaint_id,
      remarks,
    });

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(WAIVE_FINE_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("waiveFine error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
