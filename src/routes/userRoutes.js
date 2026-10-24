import express from "express";
import {
  createUser,
  createVendor,
  createComplaint,
} from "../controllers/userController.js";

const router = express.Router();

router.post("/createUser", createUser);
router.post("/createVendor", createVendor);
router.post("/createComplaint", createComplaint);

export default router;
