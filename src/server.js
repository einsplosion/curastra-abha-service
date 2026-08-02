require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { testConnection } = require("./config/db.js");
const logger = require("./config/logger.js");
const abhaRoutes = require("./routes/abha.route.js");

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(express.json());

// health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "curastra-abha-microservice",
    location: "India Region",
    timestamp: new Date().toISOString(),
  });
});

// ABHA Microservice Routes
app.use("/api/abha", abhaRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message || err);
  const statusCode = typeof err.status === "number" ? err.status : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "An unexpected error occurred",
  });
});

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  await testConnection();
  app.listen(PORT, () => {
    logger.info(`ABHA Microservice running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  logger.error("Failed to start ABHA Microservice:", { error: err.message });
  process.exit(1);
});
