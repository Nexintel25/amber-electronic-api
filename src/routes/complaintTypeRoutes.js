import express from "express";
import { getComplaintTypes } from "../controllers/complaintTypeController.js";

const router = express.Router();

router.post("/getComplaintTypes", getComplaintTypes);

export default router;
