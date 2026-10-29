import bcrypt from "bcryptjs";
import {
  createUser as createUserModel,
  createVendor as createVendorModel,
  createComplaint as createComplaintModel,
} from "../models/userModel.js";
import {
  uploadMediaFiles,
  uploadBase64Media,
  cleanupUploads,
  withFileUrls,
} from "../config/s3.js";

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

// sp_create_complaint error code -> HTTP status
const COMPLAINT_STATUS_BY_CODE = {
  0: 200,
  1501: 404, // User not found or inactive
  1502: 403, // Your role cannot raise complaints
  1503: 404, // Building not found or inactive
  1504: 403, // You do not have access to this building
  1505: 400, // Complaint title is required
  1506: 400, // Description is required
  1507: 400, // Area / location is required
  1508: 400, // Invalid category
  1509: 400, // Invalid complaint type
  1510: 409, // No vendor is mapped to this building
  1511: 400, // Maximum 10 photos allowed
  1512: 400, // Maximum 2 videos allowed
  1513: 400, // media must be a JSON array
  1514: 400, // Invalid media (kind / file_url)
  5000: 500, // Database error
};

// is_draft: 1 / "1" / true / "true" -> draft, anything else (or missing) -> submit
const parseIsDraft = (value) =>
  value === 1 || value === true || value === "1" || value === "true";

export const createComplaint = async (req, res) => {
  const uploadedKeys = [];
  try {
    const {
      building_id,
      category_id,
      complaint_type_id,
      title,
      description,
      area_location,
      asset_code,
      preferred_visit,
      latitude,
      longitude,
      location_accuracy,
      contact_name,
      contact_phone,
      is_draft,
    } = req.body;

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    // photos go to S3 either as form-data files or as base64 inside a JSON "media" array.
    // complaint_id does not exist yet, so they all go under complaints/initial
    const folder = "complaints/initial";
    const uploaded = req.files?.length
      ? await uploadMediaFiles(req.files, folder, uploadedKeys)
      : null;
    const media = uploaded ?? (await uploadBase64Media(req.body.media, folder, uploadedKeys));

    const result = await createComplaintModel({
      userId,
      buildingId: building_id,
      categoryId: category_id,
      complaintTypeId: complaint_type_id,
      title,
      description,
      areaLocation: area_location,
      assetCode: asset_code,
      preferredVisit: preferred_visit,
      latitude,
      longitude,
      locationAccuracy: location_accuracy,
      contactName: contact_name,
      contactPhone: contact_phone,
      media,
      isDraft: parseIsDraft(is_draft),
    });

    if (result.code !== 0) await cleanupUploads(uploadedKeys);

    // TODO: send FCM push to result.pushRecipients, then set notifications.is_pushed = 1

    return res.status(COMPLAINT_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data && {
        ...result.data,
        media: Array.isArray(media) ? await withFileUrls(media) : [],
      },
    });
  } catch (err) {
    console.error("createComplaint error:", err);
    await cleanupUploads(uploadedKeys);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
