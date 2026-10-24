import pool from "../config/db.js";

// Calls sp_login_get_user.
// Result set 1: { error_code, error_message, attempts_left? }
// Result set 2 (only on success): user row incl. id, name, email, role, password_hash
export const getLoginUser = async ({ email, ip, userAgent, deviceId }) => {
  const [results] = await pool.query("CALL sp_login_get_user(?, ?, ?, ?)", [
    email ?? null,
    ip ?? null,
    userAgent ?? null,
    deviceId ?? null,
  ]);

  const status = results[0][0];
  const user = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    attemptsLeft: status.attempts_left ?? null,
    user,
  };
};

// Calls sp_login_success (stores the refresh token hash + device/session info).
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): session / user details
export const loginSuccess = async ({
  userId,
  refreshTokenHash,
  expiresAt,
  deviceId,
  deviceName,
  deviceType,
  os,
  browser,
  appVersion,
  ip,
  userAgent,
  fcmToken,
}) => {
  const [results] = await pool.query(
    "CALL sp_login_success(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      refreshTokenHash ?? null,
      expiresAt ?? null,
      deviceId ?? null,
      deviceName ?? null,
      deviceType ?? "web",
      os ?? null,
      browser ?? null,
      appVersion ?? null,
      ip ?? null,
      userAgent ?? null,
      fcmToken ?? null,
    ]
  );

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};
