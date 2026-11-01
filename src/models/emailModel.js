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
// Result set 1: { error_code, error_message }
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
  const [results, fields] = await pool.query(
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
    data: status.error_code === 0 ? mapResultSets(results, fields, [{ key: "profile", single: true }]) : null,
  };
};

// Calls sp_assign_mail_profile (buildings that send as the given brand).
// Result set 1: { error_code, error_message }
export const assignMailProfile = async ({ userId, buildingIds, profileCode }) => {
  const [results, fields] = await pool.query("CALL sp_assign_mail_profile(?, ?, ?)", [
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
    data: status.error_code === 0 ? mapResultSets(results, fields, []) : null,
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
  const value = status.email_notifications ?? status.enabled ?? null;

  return {
    code: status.error_code,
    message: status.error_message,
    emailNotifications: value == null ? null : Number(value) === 1,
  };
};

// Calls sp_claim_pending_emails (locks up to `limit` unsent notification rows for this run).
// One row per mail: notification + recipient + the brand profile of the complaint's building.
// A leading { error_code } status row, if the SP sends one, is skipped.
export const claimPendingEmails = async ({ limit }) => {
  const [results] = await pool.query("CALL sp_claim_pending_emails(?)", [limit]);

  const sets = results.filter(Array.isArray);
  const hasStatusRow = sets[0]?.[0] && "error_code" in sets[0][0] && sets.length > 1;
  const rows = (hasStatusRow ? sets[1] : sets[0]) ?? [];

  return rows.map((row) => ({
    notificationId: row.notification_id ?? row.id,
    toEmail: row.to_email ?? row.email,
    toName: row.to_name ?? row.name ?? null,
    title: row.title ?? null,
    message: row.message ?? "",
    complaintId: row.complaint_id ?? null,
    fromName: row.from_name ?? null,
    fromEmail: row.from_email ?? null,
    replyTo: row.reply_to ?? null,
    envPrefix: row.env_prefix ?? null,
  }));
};

// Calls sp_mark_notifications_emailed with the outcome of every claimed row:
// [{ id, ok: 1 | 0, error }] -> ok sets is_emailed = 1, a failure is retried by the SP's own rules.
export const markNotificationsEmailed = async ({ results: outcomes }) => {
  const [results] = await pool.query("CALL sp_mark_notifications_emailed(?)", [
    JSON.stringify(outcomes),
  ]);

  const status = Array.isArray(results[0]) ? results[0][0] : null;

  return {
    code: status?.error_code ?? 0,
    message: status?.error_message ?? null,
  };
};
