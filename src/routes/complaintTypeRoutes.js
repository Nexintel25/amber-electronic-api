import express from "express";
import {
  getComplaintTypes,
  getBuildings,
  getVendors,
  getUserTypes,
  getBenchmarkReport,
  recordComplaintFeedback,
  setComplianceRule,
  getComplaintRegisterReport,
  getSatisfactionReport,
  waiveFine,
} from "../controllers/complaintTypeController.js";

const router = express.Router();

router.post("/getComplaintTypes", getComplaintTypes);
router.post("/getBuildings", getBuildings);
router.post("/getVendors", getVendors);
router.post("/getUserTypes", getUserTypes);
router.post("/getBenchmarkReport", getBenchmarkReport);
router.post("/recordComplaintFeedback", recordComplaintFeedback);
router.post("/setComplianceRule", setComplianceRule);
router.post("/getComplaintRegisterReport", getComplaintRegisterReport);
router.post("/getSatisfactionReport", getSatisfactionReport);
router.post("/waiveFine", waiveFine);

export default router;
