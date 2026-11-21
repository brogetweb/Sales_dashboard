import "dotenv/config";

// Railway servers run in UTC. Follow-up "today/overdue" logic uses local
// day boundaries, so pin the process to India time unless overridden.
process.env.TZ = process.env.TZ || "Asia/Kolkata";

import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import startReminderJob from "./jobs/reminderJob.js";

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  console.error(`Missing required env variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const app = express();

app.set("trust proxy", 1);

// FRONTEND_URL can be a comma-separated list, e.g.
// "https://my-app.vercel.app,http://localhost:5173"
const normalizeOrigin = (url) => url.trim().replace(/\/+$/, "");

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl, health checks) and any origin
      // when no FRONTEND_URL is configured.
      if (!origin || allowedOrigins.length === 0) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(normalizeOrigin(origin))) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    message: "Customer Feedback CRM API is running",
  });
});

app.get("/health", (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;

  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? "ok" : "db_unavailable",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  startReminderJob();

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);

    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer();
