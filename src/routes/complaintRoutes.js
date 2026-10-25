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
  getVendorVerificationList,
  createSupportTicket,
  getMyTickets,
  adminGetTickets,
  updateTicketStatus,
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
router.post("/getVendorVerificationList", getVendorVerificationList);
router.post("/createSupportTicket", createSupportTicket);
router.post("/getMyTickets", getMyTickets);
router.post("/adminGetTickets", adminGetTickets);
router.post("/updateTicketStatus", updateTicketStatus);

export default router;
