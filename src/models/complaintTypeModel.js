import pool from "../config/db.js";

// Calls sp_get_complaint_types.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): complaint type rows
export const getComplaintTypes = async ({ onlyActive }) => {
  const [results] = await pool.query("CALL sp_get_complaint_types(?)", [
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

// Calls sp_get_buildings.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): building rows visible to the user (role based)
export const getBuildings = async ({ userId, onlyActive, search }) => {
  const [results] = await pool.query("CALL sp_get_buildings(?, ?, ?)", [
    userId ?? null,
    onlyActive ? 1 : 0,
    search ?? null,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_get_vendors.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): vendor rows visible to the user (role based)
export const getVendors = async ({ userId, onlyActive, search }) => {
  const [results] = await pool.query("CALL sp_get_vendors(?, ?, ?)", [
    userId ?? null,
    onlyActive ? 1 : 0,
    search ?? null,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_get_user_types.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): user type rows
export const getUserTypes = async ({ onlyActive }) => {
  const [results] = await pool.query("CALL sp_get_user_types(?)", [
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

// Calls sp_report_benchmark.
// Result set 1: { error_code, error_message, month }
// Result set 2 (only on success): summary { month, minor_complaints_counted, green, yellow, red, ontime_pct, breaches, total_penalty }
// Result set 3 (only on success): rows by category
// Result set 4 (only on success): rows by vendor + category
export const getBenchmarkReport = async ({ userId, month, vendorId }) => {
  const [results] = await pool.query("CALL sp_report_benchmark(?, ?, ?)", [
    userId ?? null,
    month ?? null,
    vendorId ?? null,
  ]);

  const status = results[0][0];
  const summary = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const byCategory = Array.isArray(results[2]) ? results[2] : [];
  const byVendor = Array.isArray(results[3]) ? results[3] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    month: status.month,
    summary,
    byCategory,
    byVendor,
  };
};

// Calls sp_record_complaint_feedback.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): { complaint_id, complaint_no, satisfied, remarks }
export const recordComplaintFeedback = async ({
  userId,
  complaintId,
  satisfied,
  remarks,
}) => {
  const [results] = await pool.query(
    "CALL sp_record_complaint_feedback(?, ?, ?, ?)",
    [userId ?? null, complaintId ?? null, satisfied ?? null, remarks ?? null]
  );

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_set_compliance_rule.
// Result set 1: { error_code, error_message }
// Inserts the rule, or updates it when the category + rule_type already has one
export const setComplianceRule = async ({
  userId,
  categoryId,
  ruleType,
  tier1Pct,
  tier1Amount,
  tier2Pct,
  tier2Amount,
}) => {
  const [results] = await pool.query(
    "CALL sp_set_compliance_rule(?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      categoryId ?? null,
      ruleType ?? null,
      tier1Pct ?? null,
      tier1Amount ?? null,
      tier2Pct ?? null,
      tier2Amount ?? null,
    ]
  );

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
  };
};

// Calls sp_report_complaint_register.
// Result set 1: { error_code, error_message, month, total_count }
// Result set 2 (only on success): summary { total_complaints, closed, open_count, green, yellow, red, pending, avg_attend_minutes, avg_resolve_minutes }
// Result set 3 (only on success): one page of complaint rows (all rows, max 50000, when export = 1)
export const getComplaintRegisterReport = async ({
  userId,
  month,
  vendorId,
  categoryId,
  status,
  search,
  page,
  limit,
  isExport,
}) => {
  const [results] = await pool.query(
    "CALL sp_report_complaint_register(?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      month ?? null,
      vendorId ?? null,
      categoryId ?? null,
      status ?? null,
      search ?? null,
      page,
      limit,
      isExport ? 1 : 0,
    ]
  );

  const statusRow = results[0][0];
  const summary = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const data = Array.isArray(results[2]) ? results[2] : [];

  return {
    code: statusRow.error_code,
    message: statusRow.error_message,
    month: statusRow.month,
    total: statusRow.total_count,
    summary,
    data,
  };
};

// Calls sp_report_satisfaction.
// Result set 1: { error_code, error_message, month }
// Result set 2 (only on success): summary { month, closed_complaints, feedback_received, satisfied, not_satisfied, satisfied_pct, breaches, total_penalty }
// Result set 3 (only on success): rows by vendor + category
// Result set 4 (only on success): every feedback of the month
export const getSatisfactionReport = async ({ userId, month, vendorId }) => {
  const [results] = await pool.query("CALL sp_report_satisfaction(?, ?, ?)", [
    userId ?? null,
    month ?? null,
    vendorId ?? null,
  ]);

  const status = results[0][0];
  const summary = Array.isArray(results[1]) ? results[1][0] ?? null : null;
  const byVendor = Array.isArray(results[2]) ? results[2] : [];
  const feedbacks = Array.isArray(results[3]) ? results[3] : [];

  return {
    code: status.error_code,
    message: status.error_message,
    month: status.month,
    summary,
    byVendor,
    feedbacks,
  };
};
