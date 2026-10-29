import {
  getMyProfile as getMyProfileModel,
  getNotifications as getNotificationsModel,
  markNotificationsRead as markNotificationsReadModel,
} from "../models/productModel.js";

// sp_get_my_profile error code -> HTTP status
const MY_PROFILE_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  5000: 500, // Database error
};

export const getMyProfile = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    const result = await getMyProfileModel({ userId });

    return res.status(MY_PROFILE_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    console.error("getMyProfile error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_get_notifications error code -> HTTP status
const NOTIFICATIONS_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  5000: 500, // Database error
};

export const getNotifications = async (req, res) => {
  try {
    const input = { ...req.query, ...req.body };

    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? input.user_id;

    // same defaults as the SP: page >= 1, limit 1..100 (default 20)
    const page = Math.max(parseInt(input.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(input.limit, 10) || 20, 1), 100);

    const result = await getNotificationsModel({
      userId,
      filter: input.filter, // "unread" -> unread only, anything else -> all
      page,
      limit,
    });

    return res.status(NOTIFICATIONS_STATUS_BY_CODE[result.code] ?? 400).json({
      success: result.code === 0,
      code: result.code,
      message: result.message,
      unread_count: result.unreadCount,
      // any new status column / result set the SP adds shows up here without a code change
      ...result.extra,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};

// sp_mark_notifications_read error code -> HTTP status
const MARK_NOTIFICATIONS_READ_STATUS_BY_CODE = {
  0: 200,
  1601: 404, // User not found or inactive
  2601: 404, // Notification not found (or not this user's)
  5000: 500, // Database error
};

export const markNotificationsRead = async (req, res) => {
  try {
    // TODO: take this only from req.user once auth middleware is added
    const userId = req.user?.id ?? req.body.user_id;

    // notification_id given -> mark that one, missing -> mark ALL as read
    const result = await markNotificationsReadModel({
      userId,
      notificationId: req.body.notification_id,
    });

    return res
      .status(MARK_NOTIFICATIONS_READ_STATUS_BY_CODE[result.code] ?? 400)
      .json({
        success: result.code === 0,
        code: result.code,
        message: result.message,
        data: result.data,
      });
  } catch (err) {
    console.error("markNotificationsRead error:", err);
    return res
      .status(500)
      .json({ success: false, code: 5000, message: `Database error: ${err.message}` });
  }
};
