import express from "express";
import { uploadMedia } from "../middlewares/upload.js";
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
  getVendorVerificationList,
  createSupportTicket,
  getMyTickets,
  adminGetTickets,
  updateTicketStatus,
  getAllUsers,
} from "../controllers/complaintController.js";

const router = express.Router();

router.post("/getBuildingComplaintTypes", getBuildingComplaintTypes);
router.post("/getComplaintCategories", getComplaintCategories);
router.post("/getComplaints", getComplaints);
router.post("/getComplaintDetail", getComplaintDetail);
router.post("/getVendorWorkers", getVendorWorkers);
router.post("/assignWorker", assignWorker);
router.post("/workerCheckin", workerCheckin);
router.post("/workerStart", uploadMedia, workerStart);
router.post("/workerSubmit", uploadMedia, workerSubmit);
router.post("/getVendorVerificationList", getVendorVerificationList);
router.post("/createSupportTicket", createSupportTicket);
router.post("/getMyTickets", getMyTickets);
router.post("/adminGetTickets", adminGetTickets);
router.post("/updateTicketStatus", updateTicketStatus);
router.post("/getAllUsers", getAllUsers);

export default router;
