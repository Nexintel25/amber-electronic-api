import express from "express";
import { authenticate, roleGuard } from "../middlewares/auth.js";
import {
  health,
  getSystemOverview,
} from "../controllers/systemMonitorController.js";

const router = express.Router();

// public: the external pinger has no login, the HEALTH_KEY query param is checked instead
router.get("/health", health);
router.get(
  "/admin/system-overview",
  authenticate,
  roleGuard("super_admin"),
  getSystemOverview
);

export default router;
