import crypto from "crypto";
import {
  profileEditRequest as profileEditRequestModel,
  profileEditConfirm as profileEditConfirmModel,
  getProfileHistory as getProfileHistoryModel,
} from "../models/profileModel.js";
import { otpMail, sendMail } from "../utils/mailer.js";

const OTP_MINUTES = 10;

// SP error code -> HTTP status
const STATUS_BY_CODE = {
  0: 200,
  3401: 400, // Nothing to change
  3402: 400, // Name must be 2 to 100 characters
  3403: 400, // Phone must be 7 to 15 digits
  3404: 400, // Valid email is required
  3405: 409, // This email is already used by another user
  3406: 429, // Too many OTP requests
  3407: 404, // User not found or inactive
  3408: 403, // Not allowed (history of another user)
  3411: 400, // Invalid or expired OTP
  3412: 429, // Too many wrong tries, request a new OTP
  5000: 500, // Database error
};

// only the HMAC of an OTP is stored; bound to the user so one user's OTP never matches another's
const hashOtp = (userId, otp) => {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error("OTP_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(`profile:${userId}:${otp}`).digest("hex");
};

// The SP compares this with NOW(); the database clock runs in UTC, so send UTC
// (a JS Date would be sent in the server's local time, e.g. IST locally).
const utcDateTime = (date) => date.toISOString().slice(0, 19).replace("T", " ");

// missing -> null (keep the current value), anything else -> trimmed string
const optionalText = (value) => (value == null ? null : String(value).trim());

// Requires authenticate. Body: only the fields that change
// { name, phone, email, photo_url }  photo_url "" -> remove the DP, missing -> keep it.
// Nothing is saved here: the OTP goes to the user's CURRENT email and /confirm applies the change.
export const requestProfileEdit = async (req, res) => {
  try {
    const { name, phone, email, photo_url } = req.body ?? {};
    const userId = req.user.id;

    const otp = crypto.randomInt(0, 1000000).toString().padStart(6, "0");

    const result = await profileEditRequestModel({
      userId,
      name: optionalText(name),
      phone: optionalText(phone),
      email: optionalText(email),
      // "" must reach the SP as "" (remove DP), so only missing becomes null
      photo: optionalText(photo_url),
      otpHash: hashOtp(userId, otp),
      expiresAt: utcDateTime(new Date(Date.now() + OTP_MINUTES * 60000)),
      ip: req.ip,
    });

    if (result.code !== 0) {
      return res.status(STATUS_BY_CODE[result.code] ?? 400).json({
        success: false,
        code: result.code,
        message: result.message,
      });
    }

    // the request is stored; if the mail fails the user simply asks for a new OTP
    try {
      const mailTo = result.mailTo;
      if (!mailTo?.email) throw new Error("no usable mail profile");

      await sendMail({
        envPrefix: mailTo.env_prefix,
        fromName: mailTo.from_name,
        fromEmail: mailTo.from_email,
        replyTo: mailTo.reply_to,
        to: mailTo.name ? { name: mailTo.name, address: mailTo.email } : mailTo.email,
        ...otpMail({
          toName: mailTo.name,
          otp,
          minutes: OTP_MINUTES,
          purpose: "update your profile",
          brandName: mailTo.from_name,
        }),
      });
    } catch (err) {
      console.error("requestProfileEdit mail error:", err.message);
      return res.status(502).json({
        success: false,
        code: 5001,
        message: "Could not send the OTP email, please try again",
      });
    }

    return res.status(200).json({
      success: true,
      code: 0,
      message: result.message,
      expires_in_minutes: OTP_MINUTES,
    });
  } catch (err) {
    console.error("requestProfileEdit error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// Requires authenticate. Body: { otp: "123456" }
export const confirmProfileEdit = async (req, res) => {
  try {
    const otp = String(req.body?.otp ?? "").trim();
    const userId = req.user.id;

    // a malformed OTP never matches, so it is rejected without using up a try
    if (!/^\d{6}$/.test(otp)) {
      return res
        .status(400)
        .json({ success: false, code: 3411, message: "OTP must be 6 digits" });
    }

    const result = await profileEditConfirmModel({
      userId,
      otpHash: hashOtp(userId, otp),
      ip: req.ip,
    });

    return res.status(STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      ...(result.attemptsLeft != null && { attempts_left: result.attemptsLeft }),
      data: result.data,
    });
  } catch (err) {
    console.error("confirmProfileEdit error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// Requires authenticate. Query: ?page=1&limit=20&user_id=<id>
// user_id (another user's history) is allowed only for super_admin / admin; the SP checks it.
export const getProfileHistory = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // page >= 1, limit 1..100 (default 20)
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), 100);

    const result = await getProfileHistoryModel({
      userId: req.user.id,
      targetId: parseInt(input.user_id, 10) || null,
      page,
      limit,
    });

    return res.status(STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.code === 0 ? { total: result.total, rows: result.data } : null,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    console.error("getProfileHistory error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
