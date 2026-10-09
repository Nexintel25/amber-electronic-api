import {
  getComplaintTypes as getComplaintTypesModel,
  getBuildings as getBuildingsModel,
  getVendors as getVendorsModel,
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
