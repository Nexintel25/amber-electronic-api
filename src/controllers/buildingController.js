import bcrypt from "bcryptjs";
import {
  createBuildingWithUser,
  checkMedia as checkMediaModel,
  getAdminDashboard as getAdminDashboardModel,
  getPmDashboard as getPmDashboardModel,
  getPmVendors as getPmVendorsModel,
  getCreatorDashboard as getCreatorDashboardModel,
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

export const checkMedia = async (req, res) => {
  try {
    const { media, min_photos } = req.body;

    const result = await checkMediaModel({
      media,
      minPhotos: Number(min_photos) || 0,
    });

    return res.status(CHECK_MEDIA_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
    });
  } catch (err) {
    console.error("checkMedia error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

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

// sp_creator_dashboard error code -> HTTP status
const CREATOR_DASHBOARD_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Your role is not allowed to do this (clients only)
  5000: 500, // Database error
};

export const getCreatorDashboard = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // only_mine: 0 / "0" / false / "false" -> whole building, anything else (or missing) -> only mine
    const onlyMine = !(
      input.only_mine === 0 ||
      input.only_mine === false ||
      input.only_mine === "0" ||
      input.only_mine === "false"
    );

    const result = await getCreatorDashboardModel({
      userId,
      onlyMine,
      // SP clamps this to 1..20 (default 5)
      activeLimit: parseInt(input.active_limit, 10) || null,
    });

    return res.status(CREATOR_DASHBOARD_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getCreatorDashboard error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
