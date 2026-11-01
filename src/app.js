import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import morgan from "morgan";

// routes
import buildingRoutes from "./routes/buildingRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import complaintTypeRoutes from "./routes/complaintTypeRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import systemMonitorRoutes from "./routes/systemMonitorRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import { systemMetrics } from "./middlewares/systemMetrics.js";

const app = express();

// for api input in body (json)
app.use(express.json({ limit: "25mb" }));
// for api input in form-date
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// for whitelisting
app.use(
  cors({
    origin: "*",
    methods: "*",
    credentials: true,
  })
);

// morgan for scrutiny on api requests
const morganFormat = process.env.NODE_ENV === "development" ? "dev" : "common";
// /api/health and /api/internal/send-emails are skipped: they carry HEALTH_KEY / CRON_KEY
// in the query string and run every minute
// (originalUrl, because req.path is already stripped to "/health" inside the /api router)
const UNLOGGED_PATHS = new Set(["/api/health", "/api/internal/send-emails"]);
app.use(
  morgan(morganFormat, {
    skip: (req) => UNLOGGED_PATHS.has(req.originalUrl.split("?")[0]),
  })
);

// records every finished request for the system monitor (must be before all routes)
app.use(systemMetrics);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/complaint-types", complaintTypeRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/products", productRoutes);
app.use("/api", systemMonitorRoutes); // GET /api/health, GET /api/admin/system-overview
app.use("/api", emailRoutes); // cron send-emails, admin mail-profiles, me/email-notifications

app.get("/", (req, res) => {
  res.json({ message: "Amber Electronic API is running" });
});

app.use("/test", (req, res) => {
  res.send("api running...");
});

// Vercel uses this default export
export default app;
