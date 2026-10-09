import { getComplaintTypes as getComplaintTypesModel } from "../models/complaintTypeModel.js";

// SP error code -> HTTP status
const STATUS_BY_CODE = {
  0: 200,
  5000: 500, // Database error
};

export const getComplaintTypes = async (req, res) => {
  try {
    // ?only_active=0 -> all types, anything else (or missing) -> only active
    const onlyActive = req.query.only_active !== "0" && req.query.only_active !== "false";

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
