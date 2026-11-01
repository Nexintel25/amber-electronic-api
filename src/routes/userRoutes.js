import express from "express";
import { uploadMedia } from "../middlewares/upload.js";
import {
  createUser,
  createVendor,
  createComplaint,
  createClientOrg,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/createUser", createUser);
router.post("/createVendor", createVendor);
router.post("/createComplaint", uploadMedia, createComplaint);
router.post("/createClientOrg", createClientOrg);

export default router;
