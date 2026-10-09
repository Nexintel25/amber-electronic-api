import bcrypt from "bcryptjs";
import { createUser as createUserModel } from "../models/userModel.js";

// SP error code -> HTTP status
const STATUS_BY_CODE = {
  0: 201,
  1001: 400, // Name is required
  1002: 400, // Valid email is required
  1003: 400, // Password hash is required
  1004: 400, // Invalid role
  1005: 404, // Creator not found or inactive
  1006: 403, // Vendor can only create worker
  1007: 403, // You are not allowed to create users
  1008: 400, // vendor_id is required for this role
  1009: 404, // Vendor not found or inactive
  1010: 400, // building_id is required for client
  1011: 404, // Building not found or inactive
  1012: 409, // Email already exists
  5000: 500, // Database error
};

export const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, vendor_id, building_id } =
      req.body;

    // TODO: take this only from req.user once auth middleware is added
    const createdBy = req.user?.id ?? req.body.created_by;

    if (!password) {
      return res
        .status(400)
        .json({ success: false, code: 1003, message: "Password is required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await createUserModel({
      name,
      email,
      phone,
      passwordHash,
      role,
      vendorId: vendor_id,
      buildingId: building_id,
      createdBy,
    });

    return res.status(STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("createUser error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
