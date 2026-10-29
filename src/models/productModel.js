import pool from "../config/db.js";
import { mapResultSets, decimalsToNumbers } from "../utils/dbResults.js";

// Known result sets of sp_get_my_profile, in order, after the status row.
// single: true -> the section is one row, returned as an object instead of an array.
const MY_PROFILE_SECTIONS = [
  { key: "user", single: true },
  { key: "stats", single: true }, // columns depend on the user's role
  { key: "buildings" },
  { key: "contacts" }, // related vendors / project managers
  { key: "sessions" }, // active logins
];

// Calls sp_get_my_profile (any active user).
// Result set 1: { error_code, error_message }
// Result sets 2+ (only on success) are mapped by position to MY_PROFILE_SECTIONS;
// a result set the SP adds later is still returned as section_<n>.
export const getMyProfile = async ({ userId }) => {
  const [results, fields] = await pool.query("CALL sp_get_my_profile(?)", [
    userId ?? null,
  ]);

  const status = results[0][0];

  if (status.error_code !== 0) {
    return { code: status.error_code, message: status.error_message, data: null };
  }

  return {
    code: status.error_code,
    message: status.error_message,
    data: mapResultSets(results, fields, MY_PROFILE_SECTIONS),
  };
};

// Known result sets of sp_get_notifications, in order, after the status row.
const NOTIFICATIONS_SECTIONS = [{ key: "notifications" }];

// Calls sp_get_notifications (any active user, own notifications only).
// Result set 1: { error_code, error_message, total_count, unread_count }
// Result set 2 (only on success): one page of notifications, newest first
// Anything the SP adds later comes back in `extra`: new status-row columns by their
// own name, new result sets as section_<n>.
export const getNotifications = async ({ userId, filter, page, limit }) => {
  const [results, fields] = await pool.query(
    "CALL sp_get_notifications(?, ?, ?, ?)",
    [userId ?? null, filter ?? null, page, limit]
  );

  const [status] = decimalsToNumbers(results[0], fields[0]);
  const { error_code, error_message, total_count, unread_count, ...extraStatus } =
    status;

  const { notifications = [], ...extraSections } =
    error_code === 0 ? mapResultSets(results, fields, NOTIFICATIONS_SECTIONS) : {};

  return {
    code: error_code,
    message: error_message,
    total: total_count,
    unreadCount: unread_count,
    data: notifications,
    extra: { ...extraStatus, ...extraSections },
  };
};

// Calls sp_mark_notifications_read (own notifications only).
// notificationId given -> marks that one; missing -> marks ALL of the user's unread notifications.
// Result set 1: { error_code, error_message, marked_count, unread_count }
// Every status column except the code / message is returned in data, so a column
// the SP adds later shows up without a code change.
export const markNotificationsRead = async ({ userId, notificationId }) => {
  const [results, fields] = await pool.query(
    "CALL sp_mark_notifications_read(?, ?)",
    [userId ?? null, notificationId ?? null]
  );

  const [status] = decimalsToNumbers(results[0], fields[0]);
  const { error_code, error_message, ...data } = status;

  return {
    code: error_code,
    message: error_message,
    data,
  };
};
