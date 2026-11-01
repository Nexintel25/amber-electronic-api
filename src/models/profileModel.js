import pool from "../config/db.js";

// Calls sp_profile_edit_request (stores the proposed values with the OTP hash; nothing is changed yet).
// NULL field -> keep it; photo "" -> remove the DP, photo NULL -> keep the DP.
// Result set 1: { error_code, error_message }
// Result set 2 (only on success): { name, email, profile_code, from_name, from_email, reply_to, env_prefix }
//   = the user's CURRENT name / email (where the OTP goes) + the brand to send it as.
//   Empty when no mail profile is usable.
export const profileEditRequest = async ({
  userId,
  name,
  phone,
  email,
  photo,
  otpHash,
  expiresAt,
  ip,
}) => {
  const [results] = await pool.query(
    "CALL sp_profile_edit_request(?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userId ?? null,
      name ?? null,
      phone ?? null,
      email ?? null,
      photo ?? null,
      otpHash ?? null,
      expiresAt ?? null,
      ip ?? null,
    ]
  );

  const status = results[0][0];
  const mailTo = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    mailTo,
  };
};

// Calls sp_profile_edit_confirm (checks the OTP, writes history + audit log, updates the same user row).
// Result set 1: { error_code, error_message, attempts_left }
// Result set 2 (only on success): { user_id, name, email, phone, profile_photo }
export const profileEditConfirm = async ({ userId, otpHash, ip }) => {
  const [results] = await pool.query("CALL sp_profile_edit_confirm(?, ?, ?)", [
    userId ?? null,
    otpHash ?? null,
    ip ?? null,
  ]);

  const status = results[0][0];
  const data = Array.isArray(results[1]) ? results[1][0] ?? null : null;

  return {
    code: status.error_code,
    message: status.error_message,
    attemptsLeft: status.attempts_left,
    data,
  };
};

// Calls sp_get_profile_history (own history; super_admin / admin may pass another user's id).
// Result set 1: { error_code, error_message, total_count }
// Result set 2 (only on success): history rows, newest first
export const getProfileHistory = async ({ userId, targetId, page, limit }) => {
  const [results] = await pool.query("CALL sp_get_profile_history(?, ?, ?, ?)", [
    userId ?? null,
    targetId ?? null,
    page,
    limit,
  ]);

  const status = results[0][0];

  return {
    code: status.error_code,
    message: status.error_message,
    total: Number(status.total_count ?? 0),
    data: Array.isArray(results[1]) ? results[1] : [],
  };
};
