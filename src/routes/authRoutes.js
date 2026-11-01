import express from "express";
import {
  login,
  changePassword,
  resetPassword,
  refreshToken,
  logout,
  checkSession,
  forgotPassword,
  forgotPasswordReset,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.post("/login", login);
// public: called when the access token has expired
router.post("/refresh", refreshToken);
router.post("/refresh-token", refreshToken); // old URL, kept for existing callers
router.post("/change-password",authenticate, changePassword);
// Same URL for two flows (the forgot-password doc uses it too):
//   body has "otp" -> forgot password, public: { email, otp, new_password }
//   otherwise      -> admin / vendor resets another user, needs a token: { user_id, temp_password? }
router.post("/reset-password", (req, res, next) =>
  req.body?.otp != null
    ? forgotPasswordReset(req, res, next)
    : authenticate(req, res, () => resetPassword(req, res, next))
);
router.post("/forgot-password", forgotPassword);
router.post("/logout", authenticate, logout);
router.post("/check-session", authenticate, checkSession);

export default router;
