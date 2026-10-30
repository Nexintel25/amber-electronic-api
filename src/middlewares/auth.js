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
    return res
      .status(401)
      .json({ success: false, code: 1401, message: "Invalid or expired access token" });
  }
};
