import bcrypt from "bcryptjs";
import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import {
  getMailProfiles as getMailProfilesModel,
  setMailProfile as setMailProfileModel,
  assignMailProfile as assignMailProfileModel,
  emailPreference as emailPreferenceModel,
  forgotPasswordRequest as forgotPasswordRequestModel,
  forgotPasswordConfirm as forgotPasswordConfirmModel,
} from "../models/emailModel.js";
import { dispatchEmails } from "../utils/emailQueue.js";
import { otpMail, sendMail, mailBrandName } from "../utils/mailer.js";
import { OTP_MINUTES, generateOtp, isOtpFormat, hashOtp, otpExpiresAt } from "../utils/otp.js";

// SP error code -> HTTP status (any other non-zero code -> 400)
const STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Only super admin can do this
  2701: 400, // Invalid or expired OTP
  2702: 429, // Too many wrong tries, request a new OTP
  2703: 400, // Weak password / invalid password hash
  2704: 429, // Too many OTP requests
  2705: 400, // Valid email is required
  3201: 400, // Invalid profile data (code, name, valid from email, env prefix)
  3202: 404, // Mail profile not found or not active
  3203: 400, // building_ids must be a JSON array (1 to 200 ids)
  3204: 409, // The default profile can not be switched off
  5000: 500, // Database error
};

// constant-time compare so the key cannot be guessed from response timing
const isValidCronKey = (key) => {
  const expected = process.env.CRON_KEY;
  if (!expected || typeof key !== "string") return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// true / 1 / "true" / "1" -> 1, false / 0 / "false" / "0" -> 0, missing or anything else -> fallback
const parseFlag = (value, fallback) => {
  if (value === true || value === 1 || value === "true" || value === "1") return 1;
  if (value === false || value === 0 || value === "false" || value === "0") return 0;
  return fallback;
};

const sendResult = (res, result) =>
  res.status(STATUS_BY_CODE[result.code] ?? 400).json({
    success: result.code === 0,
    code: result.code,
    message: result.message,
    data: result.data,
  });

const serverError = (res, name, err) => {
  console.error(`${name} error:`, err);
  return res
    .status(500)
    .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
};

// Public endpoint for the external scheduler, called every minute (safety net for kickEmails).
// Wrong / missing key -> 200 and nothing is sent, so strangers cannot trigger mail runs.
export const sendPendingEmails = async (req, res) => {
  if (!isValidCronKey(req.query.key)) {
    return res.status(200).json({ ok: true });
  }

  try {
    const totals = await dispatchEmails();
    return res.status(200).json({ ok: true, ...totals });
  } catch (err) {
    console.error("sendPendingEmails error:", err);
    return res.status(500).json({ ok: false });
  }
};

// Requires authenticate + roleGuard("super_admin"); the user id comes only from the token.
export const getMailProfiles = async (req, res) => {
  try {
    const result = await getMailProfilesModel({ userId: req.user.id });
    return sendResult(res, result);
  } catch (err) {
    return serverError(res, "getMailProfiles", err);
  }
};

// Body: { code, from_name, from_email, reply_to, env_prefix, is_default, is_active }
// Same code again -> the profile is updated. is_active defaults to true, is_default to false.
export const setMailProfile = async (req, res) => {
  try {
    const { code, from_name, from_email, reply_to, env_prefix, is_default, is_active } =
      req.body ?? {};

    const result = await setMailProfileModel({
      userId: req.user.id,
      code,
      fromName: from_name,
      fromEmail: from_email,
      replyTo: reply_to || null,
      // env var names are upper case: "rites" -> RITES_SMTP_*
      envPrefix: typeof env_prefix === "string" ? env_prefix.trim().toUpperCase() : env_prefix,
      isDefault: parseFlag(is_default, 0),
      isActive: parseFlag(is_active, 1),
    });

    return sendResult(res, result);
  } catch (err) {
    return serverError(res, "setMailProfile", err);
  }
};

// Body: { building_ids: [1, 2, 3], profile_code: "rites" }
export const assignMailProfile = async (req, res) => {
  try {
    const { building_ids, profile_code } = req.body ?? {};

    // MySQL fails with a raw JSON error on anything but a JSON array, so reject it here
    let ids = building_ids;
    if (typeof ids === "string") {
      try {
        ids = JSON.parse(ids);
      } catch {
        ids = null;
      }
    }
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
      return res.status(400).json({
        success: false,
        code: 3203,
        message: "building_ids must be a JSON array (1 to 200 ids)",
      });
    }

    const result = await assignMailProfileModel({
      userId: req.user.id,
      buildingIds: ids.map(Number),
      profileCode: profile_code,
    });

    return sendResult(res, result);
  } catch (err) {
    return serverError(res, "assignMailProfile", err);
  }
};

// Requires authenticate. Reads the logged-in user's own switch.
export const getEmailNotifications = async (req, res) => {
  try {
    const result = await emailPreferenceModel({ userId: req.user.id, enabled: null });

    return sendResult(res, {
      ...result,
      data: result.code === 0 ? { email_notifications: result.emailNotifications } : null,
    });
  } catch (err) {
    return serverError(res, "getEmailNotifications", err);
  }
};

// Body: { enabled: true | false }. Off -> no complaint emails (forgot-password OTP mails still go).
export const setEmailNotifications = async (req, res) => {
  try {
    const enabled = parseFlag(req.body?.enabled, null);
    if (enabled === null) {
      return res
        .status(400)
        .json({ success: false, code: 2801, message: "enabled must be true or false" });
    }

    const result = await emailPreferenceModel({ userId: req.user.id, enabled });

    return sendResult(res, {
      ...result,
      data:
        result.code === 0
          ? { email_notifications: result.emailNotifications ?? enabled === 1 }
          : null,
    });
  } catch (err) {
    return serverError(res, "setEmailNotifications", err);
  }
};


// ---------- forgot password (public, no login) ----------

const MIN_PASSWORD_LENGTH = 8;

const fail = (res, code, message, extra = {}) =>
  res.status(STATUS_BY_CODE[code] ?? 400).json({ success: false, code, message, ...extra });

// letters + digits, min 8
const isStrongPassword = (password) =>
  password.length >= MIN_PASSWORD_LENGTH && /[A-Za-z]/.test(password) && /\d/.test(password);

const normalizeEmail = (email) => String(email ?? "").trim().toLowerCase();

const FORGOT_ANSWER = "If the email is registered, an OTP has been sent";

// POST /api/auth/forgot-password  Body: { email }  -> sp_forgot_password_request
// The answer is the same for known and unknown emails, and the mail is sent after the response,
// so neither the text nor the timing shows whether an account exists.
export const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) {
      return fail(res, 2705, "Valid email is required");
    }

    const otp = generateOtp();

    const result = await forgotPasswordRequestModel({
      email,
      otpHash: hashOtp("forgot", email, otp),
      expiresAt: otpExpiresAt(),
      ip: req.ip,
    });

    if (result.code !== 0) {
      return fail(res, result.code, result.message);
    }

    // mailTo is only returned for a registered, active user (and an active default mail profile)
    const { mailTo } = result;
    if (mailTo?.email) {
      const job = sendMail({
        to: mailTo.name ? { name: mailTo.name, address: mailTo.email } : mailTo.email,
        ...otpMail({
          toName: mailTo.name,
          otp,
          minutes: OTP_MINUTES,
          purpose: "reset your password",
          brandName: mailBrandName(),
        }),
      }).catch((err) => console.error("forgotPassword mail error:", err.message));
      try {
        waitUntil(job); // keeps a Vercel function alive until the mail is out
      } catch {
        // not on Vercel: the promise keeps running on its own
      }
    }

    return res.status(200).json({ success: true, code: 0, message: FORGOT_ANSWER });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return fail(res, 5000, "Server error, please try again");
  }
};

// POST /api/auth/forgot-password-confirm  Body: { email, otp, new_password }  -> sp_forgot_password_confirm
// On success the password is changed, the lock is cleared and every session of the user is closed.
export const forgotPasswordConfirm = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp ?? "").trim();
    const newPassword = String(req.body?.new_password ?? "");

    if (!email || !isOtpFormat(otp)) {
      return fail(res, 2701, "Invalid or expired OTP");
    }
    if (!isStrongPassword(newPassword)) {
      return fail(
        res,
        2703,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters with a letter and a number`
      );
    }

    const result = await forgotPasswordConfirmModel({
      email,
      otpHash: hashOtp("forgot", email, otp),
      newPasswordHash: await bcrypt.hash(newPassword, 10),
      ip: req.ip,
    });

    if (result.code !== 0) {
      return fail(
        res,
        result.code,
        result.message,
        result.attemptsLeft != null ? { attempts_left: result.attemptsLeft } : {}
      );
    }

    return res.status(200).json({ success: true, code: 0, message: result.message });
  } catch (err) {
    console.error("forgotPasswordConfirm error:", err);
    return fail(res, 5000, "Server error, please try again");
  }
};
