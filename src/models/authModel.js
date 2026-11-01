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

// Calls sp_change_my_password (updates the hash and revokes every other session).
// Result set 1: { error_code, error_message }
// Result set 2 (if the SP returns one): extra details, e.g. revoked session count
export const changeMyPassword = async ({
  userId,
  newPasswordHash,
  keepSessionId,
  ip,
}) => {
  const [results] = await pool.query(
    "CALL sp_change_my_password(?, ?, ?, ?)",
    [userId ?? null, newPasswordHash ?? null, keepSessionId ?? null, ip ?? null]
  );

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_reset_user_password (actor sets a temporary password for the target user).
// Result set 1: { error_code, error_message }
// Result set 2 (if the SP returns one): extra details
export const resetUserPassword = async ({
  actorId,
  targetId,
  tempPasswordHash,
  ip,
}) => {
  const [results] = await pool.query(
    "CALL sp_reset_user_password(?, ?, ?, ?)",
    [actorId ?? null, targetId ?? null, tempPasswordHash ?? null, ip ?? null]
  );

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    data,
  };
};

// Calls sp_forgot_password_request (stores the OTP hash; an OTP row is written even for an
// unknown email, so the answer never shows whether an account exists).
// Result set 1: { error_code, error_message }
// Result set 2 (only for a registered, active email with an active default mail profile):
//   { name, email, profile_code, from_name, from_email, reply_to, env_prefix }
export const forgotPasswordRequest = async ({ email, otpHash, expiresAt, ip }) => {
  const [results] = await pool.query("CALL sp_forgot_password_request(?, ?, ?, ?)", [
    email ?? null,
    otpHash ?? null,
    expiresAt ?? null,
    ip ?? null,
  ]);

  const status = results[0][0];
  const mailTo = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    mailTo,
  };
};

// Calls sp_forgot_password_confirm (checks the OTP, sets the new hash, closes every session).
// Result set 1: { error_code, error_message, attempts_left }
export const forgotPasswordConfirm = async ({ email, otpHash, newPasswordHash, ip }) => {
  const [results] = await pool.query("CALL sp_forgot_password_confirm(?, ?, ?, ?)", [
    email ?? null,
    otpHash ?? null,
    newPasswordHash ?? null,
    ip ?? null,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    attemptsLeft: status.attempts_left,
  };
};

// Calls sp_refresh_session (rotates the refresh token of one session).
// Result set 1: { error_code, error_message, session_id }
// Result set 2 (only on success): user row { id, name, email, phone, role, vendor_id, must_change_password }
// Reusing an already rotated token revokes the whole session (1411).
export const refreshSession = async ({
  oldHash,
  newHash,
  newExpiresAt,
  ip,
  userAgent,
}) => {
  const [results] = await pool.query(
    "CALL sp_refresh_session(?, ?, ?, ?, ?)",
    [
      oldHash ?? null,
      newHash ?? null,
      newExpiresAt ?? null,
      ip ?? null,
      // column is VARCHAR(500)
      userAgent ? String(userAgent).slice(0, 500) : null,
    ]
  );

  const status = results[0][0];
  const user = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    sessionId: status.session_id ?? null,
    user,
  };
};

// Calls sp_logout (revokes sessions of the user).
// sessionId given -> only that session; NULL -> ALL active sessions of the user.
// Result set 1: { error_code, error_message, sessions_closed }
export const logout = async ({ userId, sessionId }) => {
  const [results] = await pool.query("CALL sp_logout(?, ?)", [
    userId ?? null,
    sessionId ?? null,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    sessionsClosed: status.sessions_closed ?? 0,
  };
};

// Calls sp_check_session (is this session still usable?).
// Open = session not revoked, not expired, and the user is active.
// Result set 1: { error_code, error_message, session_open (1 / 0) }
export const checkSession = async ({ userId, sessionId }) => {
  const [results] = await pool.query("CALL sp_check_session(?, ?)", [
    userId ?? null,
    sessionId ?? null,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    sessionOpen: Number(status.session_open) === 1,
  };
};
