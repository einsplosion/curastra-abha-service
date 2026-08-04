require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { testConnection } = require("./config/db.js");
const logger = require("./config/logger.js");
const abhaRoutes = require("./routes/abha.route.js");

const app = express();

app.set("trust proxy", true);

app.use(helmet());
app.use(cors());
app.use(express.json());

const axios = require("axios");

// health check endpoints
const healthCheckHandler = async (req, res) => {
  logger.info(`${req.path} route called`);
  
  let outboundIp = "Unknown";
  let geoDetails = {};

  try {
    const ipRes = await axios.get("http://ip-api.com/json/", { timeout: 4000 });
    outboundIp = ipRes.data.query;
    geoDetails = {
      country: ipRes.data.country,
      countryCode: ipRes.data.countryCode,
      region: ipRes.data.regionName,
      city: ipRes.data.city,
      isp: ipRes.data.isp,
    };
  } catch (err) {
    logger.error("Failed to resolve outbound IP:", err.message);
  }

  res.json({
    status: "ok",
    service: "curastra-abha-microservice",
    outboundIp,
    geoDetails,
    timestamp: new Date().toISOString(),
  });
};

app.get("/", healthCheckHandler);
app.get("/health", healthCheckHandler);
app.get("/api/abha/health", healthCheckHandler);
app.get("/status", healthCheckHandler);

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
  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`ABHA Microservice running on port ${PORT} (0.0.0.0)`);
  });
};

startServer().catch((err) => {
  logger.error("Failed to start ABHA Microservice:", { error: err.message });
  process.exit(1);
});
