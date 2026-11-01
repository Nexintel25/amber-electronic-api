import crypto from "crypto";
import {
  getMailProfiles as getMailProfilesModel,
  setMailProfile as setMailProfileModel,
  assignMailProfile as assignMailProfileModel,
  emailPreference as emailPreferenceModel,
} from "../models/emailModel.js";
import { dispatchEmails } from "../utils/emailQueue.js";

// SP error code -> HTTP status (any other non-zero code -> 400)
const STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  1603: 403, // Only super admin can do this
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

    const result = await assignMailProfileModel({
      userId: req.user.id,
      buildingIds: building_ids,
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
