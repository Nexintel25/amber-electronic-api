import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  getLoginUser,
  loginSuccess,
  changeMyPassword,
  resetUserPassword,
  refreshSession,
  logout as logoutModel,
  checkSession as checkSessionModel,
} from "../models/authModel.js";

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS) || 30;
const DEVICE_TYPES = ["web", "android", "ios", "other"];

// SP error code -> HTTP status
const STATUS_BY_CODE = {
  0: 200,
  1401: 401, // Invalid email or password
  1402: 403, // Account is inactive
  1403: 423, // Account locked
  1404: 404, // User not found or inactive
  1405: 400, // Refresh token hash is required
  1406: 400, // Current and new password are required
  1407: 400, // New password too short
  1408: 400, // New password same as current
  1409: 401, // Current password is incorrect
  1410: 400, // Valid target user id is required
  5000: 500, // Database error
};

// only the SHA-256 hash of a refresh token is ever stored
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Login and refresh both use these two helpers, so they issue identical tokens.
// Refresh token: random opaque string; only its hash goes to the DB.
const newRefreshToken = () => {
  const token = crypto.randomBytes(48).toString("hex");
  return {
    token,
    hash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86400000),
  };
};

// Access token: short-lived JWT; sid = session id (needed for logout / check-session)
const signAccessToken = (user, sessionId) =>
  jwt.sign(
    {
      id: user.id ?? user.user_id,
      role: user.role,
      email: user.email,
      vendor_id: user.vendor_id ?? null,
      sid: sessionId,
      must_change_password: user.must_change_password ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const fail = (res, code, message, extra = {}) =>
  res.status(STATUS_BY_CODE[code] ?? 400).json({
    success: false,
    code,
    message,
    ...extra,
  });

export const login = async (req, res) => {
  try {
    const {
      email,
      password,
      device_id,
      device_name,
      device_type,
      os,
      browser,
      app_version,
      fcm_token,
    } = req.body;

    if (!email || !password) {
      return fail(res, 1401, "Invalid email or password");
    }

    const ip = req.ip;
    const userAgent = req.get("user-agent");

    // 1. fetch user (SP also handles lock / inactive checks)
    const found = await getLoginUser({
      email: String(email).trim().toLowerCase(),
      ip,
      userAgent,
      deviceId: device_id,
    });

    if (found.code !== 0 || !found.user) {
      return fail(res, found.code || 1404, found.message || "User not found", {
        attempts_left: found.attemptsLeft,
      });
    }

    const { password_hash: passwordHash, ...user } = found.user;

    // 2. verify password
    const ok = passwordHash && (await bcrypt.compare(password, passwordHash));
    if (!ok) {
      return fail(res, 1401, "Invalid email or password", {
        attempts_left: found.attemptsLeft,
      });
    }

    // 3. new refresh token; only its SHA-256 hash is stored with the session
    const userId = user.id ?? user.user_id;
    const {
      token: refreshToken,
      hash: refreshTokenHash,
      expiresAt,
    } = newRefreshToken();

    const session = await loginSuccess({
      userId,
      refreshTokenHash,
      expiresAt,
      deviceId: device_id,
      deviceName: device_name,
      deviceType: DEVICE_TYPES.includes(device_type) ? device_type : "web",
      os,
      browser,
      appVersion: app_version,
      ip,
      userAgent,
      fcmToken: fcm_token,
    });

    if (session.code !== 0) {
      return fail(res, session.code, session.message);
    }

    // sid = current session id, used to keep this session alive on password change
    const sessionId = session.data?.session_id ?? session.data?.id ?? null;

    const accessToken = signAccessToken(user, sessionId);

    return res.status(200).json({
      success: true,
      code: 0,
      message: "Login successful",
      data: {
        user,
        session_id: sessionId,
        access_token: accessToken,
        refresh_token: refreshToken,
        refresh_token_expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    return fail(res, 5000, `Database error: ${err.message}`);
  }
};

const MIN_PASSWORD_LENGTH = 8;

// Requires authenticate middleware (req.user = { id, email, sid })
export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const { id: userId, email, sid } = req.user;

    if (!current_password || !new_password) {
      return fail(res, 1406, "Current password and new password are required");
    }
    if (String(new_password).length < MIN_PASSWORD_LENGTH) {
      return fail(
        res,
        1407,
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
    }
    if (current_password === new_password) {
      return fail(res, 1408, "New password must be different from current password");
    }

    const ip = req.ip;

    // 1. fetch current hash (SP also handles lock / inactive checks)
    const found = await getLoginUser({
      email: email ? String(email).trim().toLowerCase() : null,
      ip,
      userAgent: req.get("user-agent"),
      deviceId: null,
    });

    const foundId = found.user?.id ?? found.user?.user_id;
    if (found.code !== 0 || !found.user || Number(foundId) !== Number(userId)) {
      return fail(res, found.code || 1404, found.message || "User not found");
    }

    // 2. verify current password
    const ok =
      found.user.password_hash &&
      (await bcrypt.compare(current_password, found.user.password_hash));
    if (!ok) {
      return fail(res, 1409, "Current password is incorrect");
    }

    // 3. save new hash; SP revokes all sessions except the current one
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    const result = await changeMyPassword({
      userId,
      newPasswordHash,
      keepSessionId: sid,
      ip,
    });

    if (result.code !== 0) {
      return fail(res, result.code, result.message);
    }

    return res.status(200).json({
      success: true,
      code: 0,
      message: result.message || "Password changed successfully",
      data: result.data,
    });
  } catch (err) {
    console.error("changePassword error:", err);
    return fail(res, 5000, `Database error: ${err.message}`);
  }
};

// Requires authenticate middleware (req.user = { id }); actor permission is checked in the SP
export const resetPassword = async (req, res) => {
  try {
    const targetId = Number(req.params.userId);
    const { temp_password } = req.body ?? {};

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return fail(res, 1410, "Valid target user id is required");
    }
    if (temp_password && String(temp_password).length < MIN_PASSWORD_LENGTH) {
      return fail(
        res,
        1407,
        `Temporary password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
    }

    // use the given temp password, otherwise generate one (12 chars)
    const tempPassword = temp_password
      ? String(temp_password)
      : crypto.randomBytes(9).toString("base64url");
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

    const result = await resetUserPassword({
      actorId: req.user.id,
      targetId,
      tempPasswordHash,
      ip: req.ip,
    });

    if (result.code !== 0) {
      return fail(res, result.code, result.message);
    }

    return res.status(200).json({
      success: true,
      code: 0,
      message: result.message || "Password reset successfully",
      data: {
        ...result.data,
        user_id: targetId,
        temp_password: tempPassword,
      },
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return fail(res, 5000, `Database error: ${err.message}`);
  }
};

// sp_refresh_session error code -> HTTP status.
// Every failure is 401 so the app sends the user back to login.
// (1410 means "invalid refresh token" here, not the 1410 of STATUS_BY_CODE)
const REFRESH_STATUS_BY_CODE = {
  0: 200,
  1404: 401, // User not found or inactive (session revoked)
  1410: 401, // Invalid refresh token
  1411: 401, // Refresh token reused, session revoked
  1412: 401, // Session was revoked
  1413: 401, // Session expired
  5000: 500, // Database error
};

// Public (the access token may already be expired): takes the refresh token from login,
// returns a new access token + a NEW refresh token. The old refresh token stops working.
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body ?? {};

    if (!refresh_token || typeof refresh_token !== "string") {
      return res
        .status(401)
        .json({ success: false, code: 1410, message: "Invalid refresh token" });
    }

    const next = newRefreshToken();
    const expiresAt = next.expiresAt;

    const result = await refreshSession({
      oldHash: hashToken(refresh_token),
      newHash: next.hash,
      newExpiresAt: expiresAt,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    if (result.code !== 0 || !result.user) {
      return res.status(REFRESH_STATUS_BY_CODE[result.code] ?? 401).json({
        success: false,
        code: result.code,
        message: result.message,
      });
    }

    const { user, sessionId } = result;
    const accessToken = signAccessToken(user, sessionId);

    return res.status(200).json({
      success: true,
      code: 0,
      message: "Token refreshed",
      data: {
        user,
        session_id: sessionId,
        access_token: accessToken,
        refresh_token: next.token,
        refresh_token_expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error("refreshToken error:", err);
    return fail(res, 5000, `Database error: ${err.message}`);
  }
};

// Requires authenticate middleware (req.user = { id, sid })
// Default: logs out only the current session (sid from the access token).
// all: true (or all_devices: true) -> logs out every session of the user.
export const logout = async (req, res) => {
  try {
    // Body mirrors sp_logout(user_id, session_id); all fields optional
    const { user_id, session_id, all, all_devices } = req.body ?? {};
    const { id: userId, sid } = req.user;

    const flag = all ?? all_devices;
    const allDevices = flag === true || flag === 1 || flag === "true" || flag === "1";

    // user_id can only be your own: the token decides whose sessions are closed
    if (user_id != null && Number(user_id) !== Number(userId)) {
      return res.status(403).json({
        success: false,
        code: 1415,
        message: "user_id does not match the logged-in user",
      });
    }

    const hasSessionId = session_id != null && session_id !== "";
    if (hasSessionId && !(Number.isInteger(Number(session_id)) && Number(session_id) > 0)) {
      return res.status(400).json({
        success: false,
        code: 1416,
        message: "session_id must be a positive integer",
      });
    }

    if (hasSessionId && allDevices) {
      return res.status(400).json({
        success: false,
        code: 1417,
        message: "Send either session_id or all: true, not both",
      });
    }

    // session_id from body -> that session; all -> every session; else this device's session
    const sessionId = allDevices ? null : hasSessionId ? Number(session_id) : sid;

    // NULL session id means "all sessions" in the SP, so never send NULL by accident
    if (!allDevices && !sessionId) {
      return res.status(400).json({
        success: false,
        code: 1414,
        message: "Session id missing in token, send all: true to log out everywhere",
      });
    }

    const result = await logoutModel({ userId, sessionId });

    if (result.code !== 0) {
      return fail(res, result.code, result.message);
    }

    // an explicit session_id that closed nothing: wrong id, someone else's, or already logged out
    if (hasSessionId && result.sessionsClosed === 0) {
      return res.status(404).json({
        success: false,
        code: 1418,
        message: "Session not found or already logged out",
        data: { user_id: userId, session_id: sessionId, sessions_closed: 0 },
      });
    }

    return res.status(200).json({
      success: true,
      code: 0,
      message: result.message || "Logged out",
      data: {
        user_id: userId,
        session_id: sessionId, // null = all sessions
        current_session: allDevices || Number(sessionId) === Number(sid), // was this device logged out?
        sessions_closed: result.sessionsClosed,
      },
    });
  } catch (err) {
    console.error("logout error:", err);
    return fail(res, 5000, `Database error: ${err.message}`);
  }
};

// Requires authenticate middleware (req.user = { id, sid })
// Tells the app whether the current session is still open (not logged out / revoked /
// expired, user active). A valid JWT alone does not prove that for its last 15 minutes.
export const checkSession = async (req, res) => {
  try {
    const { id: userId, sid } = req.user;

    const result = sid
      ? await checkSessionModel({ userId, sessionId: sid })
      : { code: 0, message: "Session id missing in token", sessionOpen: false };

    if (result.code !== 0) {
      return fail(res, result.code, result.message);
    }

    return res.status(200).json({
      success: true,
      code: 0,
      message: result.message,
      data: { session_id: sid ?? null, session_open: result.sessionOpen },
    });
  } catch (err) {
    console.error("checkSession error:", err);
    return fail(res, 5000, `Database error: ${err.message}`);
  }
};
