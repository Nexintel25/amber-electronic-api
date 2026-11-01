import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  requestProfileEdit,
  confirmProfileEdit,
  getProfileHistory,
} from "../controllers/profileController.js";

const router = express.Router();

// name / phone / email / DP change: OTP to the current email first, saved only on confirm
router.post("/edit/request", authenticate, requestProfileEdit);
router.post("/edit/confirm", authenticate, confirmProfileEdit);
router.get("/history", authenticate, getProfileHistory);

export default router;
