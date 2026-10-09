import express from "express";
import {
  getComplaintTypes,
  getBuildings,
  getVendors,
} from "../controllers/complaintTypeController.js";

const router = express.Router();

router.post("/getComplaintTypes", getComplaintTypes);
router.post("/getBuildings", getBuildings);
router.post("/getVendors", getVendors);

export default router;
