const rateLimit = require("express-rate-limit");

const abhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    success: false,
    message: "Too many ABHA requests from this IP, please try again after 15 minutes.",
  },
});

module.exports = { abhaLimiter };
