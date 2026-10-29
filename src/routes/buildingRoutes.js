import express from "express";
import {
  createBuilding,
  // checkMedia,
  getAdminDashboard,
  getPmDashboard,
  getPmVendors,
  getPmWorkerDetail,
  setPmVendors,
  getCreatorDashboard,
  vendorApprove,
  vendorRework,
  getReportFilterOptions,
  getPenaltyReport,
} from "../controllers/buildingController.js";

const router = express.Router();

router.post("/createBuildingWithUser", createBuilding);
// router.post("/checkMedia", checkMedia);
router.post("/getAdminDashboard", getAdminDashboard);
router.post("/getPmDashboard", getPmDashboard);
router.post("/getPmVendors", getPmVendors);
router.post("/getPmWorkerDetail", getPmWorkerDetail);
router.post("/setPmVendors", setPmVendors);
router.post("/getCreatorDashboard", getCreatorDashboard);
router.post("/vendorApprove", vendorApprove);
router.post("/vendorRework", vendorRework);
router.post("/getReportFilterOptions", getReportFilterOptions);
router.post("/getPenaltyReport", getPenaltyReport);

export default router;
