import express from "express";
import {
  getBuildingComplaintTypes,
  getComplaintCategories,
  getComplaints,
  getComplaintDetail,
  getVendorWorkers,
  assignWorker,
  workerCheckin,
  workerStart,
  workerSubmit,
} from "../controllers/complaintController.js";

const router = express.Router();

router.post("/getBuildingComplaintTypes", getBuildingComplaintTypes);
router.post("/getComplaintCategories", getComplaintCategories);
router.post("/getComplaints", getComplaints);
router.post("/getComplaintDetail", getComplaintDetail);
router.post("/getVendorWorkers", getVendorWorkers);
router.post("/assignWorker", assignWorker);
router.post("/workerCheckin", workerCheckin);
router.post("/workerStart", workerStart);
router.post("/workerSubmit", workerSubmit);

export default router;
