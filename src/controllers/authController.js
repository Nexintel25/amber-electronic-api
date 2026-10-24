import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getLoginUser, loginSuccess } from "../models/authModel.js";

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

    const accessToken = jwt.sign(
      { id: userId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    return res.status(200).json({
      success: true,
      code: 0,
      message: "Login successful",
      data: {
        user,
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
