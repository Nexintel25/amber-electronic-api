import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  getLoginUser,
  loginSuccess,
  changeMyPassword,
  resetUserPassword,
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

    // 3. issue tokens; only the SHA-256 hash of the refresh token is stored
    const userId = user.id ?? user.user_id;
    const refreshToken = crypto.randomBytes(48).toString("hex");
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 86400000);

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

    const accessToken = jwt.sign(
      { id: userId, role: user.role, email: user.email, sid: sessionId },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

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
