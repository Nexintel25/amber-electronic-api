import bcrypt from "bcryptjs";
import {
  createUser as createUserModel,
  createVendor as createVendorModel,
} from "../models/userModel.js";

// SP error code -> HTTP status
const STATUS_BY_CODE = {
  0: 200,
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

// sp_create_vendor error code -> HTTP status
const VENDOR_STATUS_BY_CODE = {
  0: 200,
  1201: 400, // Company name is required
  1202: 403, // Only super admin can create a vendor
  1203: 409, // Company name already exists
  1204: 400, // User name is required
  1205: 400, // Valid email is required
  1206: 409, // Email already exists
  1207: 400, // Password hash is required
  1208: 404, // One or more buildings not found or inactive
  1209: 404, // Creator not found or inactive
  1210: 400, // building_ids must be a JSON array like [1,2,3]
  1211: 409, // One or more buildings already have a vendor
  5000: 500, // Database error
};

export const createVendor = async (req, res) => {
  try {
    const {
      company_name,
      contact_phone,
      user_name,
      user_email,
      password,
      building_ids,
    } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const createdBy = req.user?.id ?? req.body.created_by;

    if (!password) {
      return res
        .status(400)
        .json({ success: false, code: 1207, message: "Password is required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await createVendorModel({
      companyName: company_name,
      contactPhone: contact_phone,
      userName: user_name,
      userEmail: user_email,
      passwordHash,
      buildingIds: building_ids,
      createdBy,
    });

    return res.status(VENDOR_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("createVendor error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
