import express from "express";
import { uploadMedia } from "../middlewares/upload.js";
import {
  getMyProfile,
  getNotifications,
  markNotificationsRead,
 
} from "../controllers/productController.js";

const router = express.Router();

router.post("/getMyProfile", getMyProfile);
router.post("/getNotifications", getNotifications);
router.post("/markNotificationsRead", markNotificationsRead);

export default router;
