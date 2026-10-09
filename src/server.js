import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import morgan from "morgan";

// routes
import buildingRoutes from "./routes/buildingRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
// env variables
const port = process.env.PORT || 3003;

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
app.use("/api/buildings", buildingRoutes);
app.use("/api/users", userRoutes);

app.use("/test", (req, res) => {
  res.send("api running...");
});

// starting server log
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
