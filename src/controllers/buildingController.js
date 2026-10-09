import bcrypt from "bcryptjs";
import { createBuildingWithUser } from "../models/buildingModel.js";

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
