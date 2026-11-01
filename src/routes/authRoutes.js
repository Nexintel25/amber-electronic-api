import express from "express";
import {
  login,
  changePassword,
  resetPassword,
  refreshToken,
  logout,
  checkSession,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.post("/login", login);
// public: called when the access token has expired
router.post("/refresh", refreshToken);
router.post("/refresh-token", refreshToken); // old URL, kept for existing callers
router.post("/change-password", changePassword);
router.post("/reset-password", resetPassword);
router.post("/logout", authenticate, logout);
router.post("/check-session", authenticate, checkSession);

export default router;
