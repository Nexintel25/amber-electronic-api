import crypto from "crypto";
import {
  recordHeartbeat,
  getSystemOverview as getSystemOverviewModel,
} from "../models/systemMonitorModel.js";

// name stored with every heartbeat row
const HEALTH_INSTANCE =
  process.env.HEALTH_INSTANCE || (process.env.VERCEL ? "vercel" : "api");

// constant-time compare so the key cannot be guessed from response timing
const isValidHealthKey = (key) => {
  const expected = process.env.HEALTH_KEY;
  if (!expected || typeof key !== "string") return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Public endpoint for the external pinger (UptimeRobot, cron-job.org ...), called every minute.
// Wrong / missing key -> 200 and nothing is written, so strangers cannot fill the table.
// Correct key -> writes one heartbeat; a DB failure returns 503 so the pinger raises an alert.
export const health = async (req, res) => {
  if (!isValidHealthKey(req.query.key)) {
    return res.status(200).json({ ok: true });
  }

  try {
    const result = await recordHeartbeat({ instance: HEALTH_INSTANCE });

    if (result.code !== 0) {
      return res.status(503).json({ ok: false, database: false });
    }

    return res
      .status(200)
      .json({ ok: true, database: true, time: new Date().toISOString() });
  } catch (err) {
    console.error("health error:", err);
    return res.status(503).json({ ok: false, database: false });
  }
};

// sp_system_overview error code -> HTTP status
const SYSTEM_OVERVIEW_STATUS_BY_CODE = {
  0: 200,
  1601: 403, // User not found or inactive
  3101: 403, // Only super admin can view the system overview
  5000: 500, // Database error
};

// Requires authenticate + roleGuard("super_admin"); the user id comes only from the token.
export const getSystemOverview = async (req, res) => {
  try {
    // days 1..90 (default 7), interval = pinger interval in minutes 1..15 (default 1)
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const intervalMin = Math.min(
      Math.max(parseInt(req.query.interval, 10) || 1, 1),
      15
    );

    const result = await getSystemOverviewModel({
      userId: req.user.id,
      days,
      intervalMin,
    });

    return res.status(SYSTEM_OVERVIEW_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getSystemOverview error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
