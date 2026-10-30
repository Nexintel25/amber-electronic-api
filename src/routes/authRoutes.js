import express from "express";
import {
  login,
  changePassword,
  resetPassword,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/change-password", authenticate, changePassword);
router.post("/reset-password", authenticate, resetPassword);

export default router;
