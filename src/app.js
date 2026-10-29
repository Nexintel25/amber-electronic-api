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
app.use(morgan(morganFormat));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/complaint-types", complaintTypeRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/products", productRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Amber Electronic API is running" });
});

app.use("/test", (req, res) => {
  res.send("api running...");
});

// Vercel uses this default export
export default app;
