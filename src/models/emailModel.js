import pool from "../config/db.js";
import { mapResultSets } from "../utils/dbResults.js";

// Calls sp_get_mail_profiles (super admin: list of brand profiles).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): profiles; any later set comes back as section_<n>
export const getMailProfiles = async ({ userId }) => {
  const [results, fields] = await pool.query("CALL sp_get_mail_profiles(?)", [
    userId ?? null,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    data: status.error_code === 0 ? mapResultSets(results, fields, [{ key: "profiles" }]) : null,
  };
};

// Calls sp_set_mail_profile (creates or updates a brand profile by code).
// SMTP passwords are never stored: env_prefix only names the env block (AMBER -> AMBER_SMTP_*).
// Result set 1: { error_code, error_message } (nothing else)
export const setMailProfile = async ({
  userId,
  code,
  fromName,
  fromEmail,
  replyTo,
  envPrefix,
  isDefault,
  isActive,
}) => {
  const [results] = await pool.query(
    "CALL sp_set_mail_profile(?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      code ?? null,
      fromName ?? null,
      fromEmail ?? null,
      replyTo ?? null,
      envPrefix ?? null,
      isDefault ? 1 : 0,
      isActive ? 1 : 0,
    ]
  );

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
  };
};

// Calls sp_assign_mail_profile (buildings that send as the given brand).
// Result set 1: { error_code, error_message, buildings_updated }
export const assignMailProfile = async ({ userId, buildingIds, profileCode }) => {
  const [results] = await pool.query("CALL sp_assign_mail_profile(?, ?, ?)", [
    userId ?? null,
    // SP expects a JSON array like [1,2,3]; form-data sends it as a string already
    buildingIds == null
      ? null
      : typeof buildingIds === "string"
        ? buildingIds
        : JSON.stringify(buildingIds),
    profileCode ?? null,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    data: status.error_code === 0 ? { buildings_updated: status.buildings_updated } : null,
  };
};

// Calls sp_email_preference (the user's own on/off switch for complaint emails).
// enabled NULL -> only reads the current value, 1 / 0 -> sets it.
// Result set 1: { error_code, error_message, email_notifications }
export const emailPreference = async ({ userId, enabled }) => {
  const [results] = await pool.query("CALL sp_email_preference(?, ?)", [
    userId ?? null,
    enabled == null ? null : enabled ? 1 : 0,
  ]);

  const status = results[0][0];
  const value = status.email_notifications;

  return {
    code: status.error_code,
    message: status.error_message,
    emailNotifications: value == null ? null : Number(value) === 1,
  };
};

// Calls sp_claim_pending_emails (locks up to `limit` unsent notification rows for this run;
// rows of users who switched mails off, too old or tried 5 times are skipped by the SP).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): one row per mail: notification + recipient + complaint +
//   the brand profile of the complaint's building (or the default one; NULL if none is usable)
export const claimPendingEmails = async ({ limit }) => {
  const [results] = await pool.query("CALL sp_claim_pending_emails(?)", [limit]);

  const status = results[0][0];
  if (status.error_code !== 0) throw new Error(status.error_message);

  const rows = Array.isArray(results[1]) ? results[1] : [];

  return rows.map((row) => ({
    notificationId: row.notification_id,
    eventType: row.event_type,
    message: row.message ?? "",
    complaintId: row.complaint_id,
    complaintNo: row.complaint_no,
    complaintTitle: row.complaint_title,
    buildingName: row.building_name,
    toEmail: row.user_email,
    toName: row.user_name,
    fromName: row.from_name,
    fromEmail: row.from_email,
    replyTo: row.reply_to,
    envPrefix: row.env_prefix,
  }));
};

// Calls sp_mark_notifications_emailed with the outcome of every claimed row.
// p_results: [{ id, ok: true | false, error }] (ok must be a JSON boolean, the SP checks 'true').
// Failed rows go back to the queue until email_attempts reaches 5, then is_emailed = 2.
// Result set 1: { error_code, error_message, sent, failed }
export const markNotificationsEmailed = async ({ results: outcomes }) => {
  const [results] = await pool.query("CALL sp_mark_notifications_emailed(?)", [
    JSON.stringify(outcomes),
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    sent: Number(status.sent ?? 0),
    failed: Number(status.failed ?? 0),
  };
};
