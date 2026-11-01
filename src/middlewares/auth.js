import jwt from "jsonwebtoken";

// Verifies "Authorization: Bearer <access_token>" and sets req.user = { id, role, email, sid }
export const authenticate = (req, res, next) => {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ success: false, code: 1401, message: "Access token is required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    // TOKEN_EXPIRED -> the app calls /api/auth/refresh and retries once;
    // TOKEN_INVALID -> the app goes to login
    const expired = err.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      code: 1401,
      error_code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
      message: expired ? "Access token expired" : "Invalid access token",
    });
  }
};

// Allows only the given roles (use after authenticate)
export const roleGuard =
  (...roles) =>
  (req, res, next) => {
    if (roles.includes(req.user?.role)) return next();
    return res
      .status(403)
      .json({ success: false, code: 1403, message: "You are not allowed to do this" });
  };
