import express from "express";
import { createUser, createVendor } from "../controllers/userController.js";

const router = express.Router();

router.post("/createUser", createUser);
router.post("/createVendor", createVendor);

export default router;
