import express from "express";
import {
  getComplaintTypes,
  getBuildings,
  getVendors,
  getUserTypes,
} from "../controllers/complaintTypeController.js";

const router = express.Router();

router.post("/getComplaintTypes", getComplaintTypes);
router.post("/getBuildings", getBuildings);
router.post("/getVendors", getVendors);
router.post("/getUserTypes", getUserTypes);

export default router;
