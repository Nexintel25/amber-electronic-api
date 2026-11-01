import express from "express";
import { authenticate, roleGuard } from "../middlewares/auth.js";
import {
  sendPendingEmails,
  getMailProfiles,
  setMailProfile,
  assignMailProfile,
  getEmailNotifications,
  setEmailNotifications,
} from "../controllers/emailController.js";

const router = express.Router();

// public: the external scheduler has no login, the CRON_KEY query param is checked instead
router.get("/internal/send-emails", sendPendingEmails);

// brand profiles (who the mails are sent as), super admin only
router.get("/admin/mail-profiles", authenticate, roleGuard("super_admin"), getMailProfiles);
router.put("/admin/mail-profiles", authenticate, roleGuard("super_admin"), setMailProfile);
router.post(
  "/admin/mail-profiles/assign",
  authenticate,
  roleGuard("super_admin"),
  assignMailProfile
);

// the logged-in user's own on/off switch for complaint emails
router.get("/me/email-notifications", authenticate, getEmailNotifications);
router.put("/me/email-notifications", authenticate, setEmailNotifications);

export default router;
