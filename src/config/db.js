const { Pool } = require("pg");
const logger = require("./logger.js");

if (!process.env.DATABASE_URL) {
  logger.error("DATABASE_URL environment variable is missing!");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle PostgreSQL client", { error: err.message });
});

const testConnection = async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    logger.info(`PostgreSQL DB connected successfully (Neon DB time: ${res.rows[0].now})`);
  } catch (err) {
    logger.error("Failed to connect to Neon PostgreSQL database:", { error: err.message });
    throw err;
  }
};

module.exports = { pool, testConnection };
