import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { uploadMedia } from "../middlewares/upload.js";
import {
  getMyProfile,
  getNotifications,
  markNotificationsRead,
 
} from "../controllers/productController.js";

const router = express.Router();

// every route below needs "Authorization: Bearer <access_token>"
router.use(authenticate);

router.post("/getMyProfile", getMyProfile);
router.post("/getNotifications", getNotifications);
router.post("/markNotificationsRead", markNotificationsRead);

export default router;
