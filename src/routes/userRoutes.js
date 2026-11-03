import express from "express";
import { authenticate } from "../middlewares/auth.js";
import { uploadMedia } from "../middlewares/upload.js";
import {
  createUser,
  createVendor,
  createComplaint,
  createClientOrg,
} from "../controllers/userController.js";

const router = express.Router();

// every route below needs "Authorization: Bearer <access_token>"
router.use(authenticate);

router.post("/createUser", createUser);
router.post("/createVendor", createVendor);
router.post("/createComplaint", uploadMedia, createComplaint);
router.post("/createClientOrg", createClientOrg);

export default router;
