const { Pool } = require("pg");

// Use Render's PostgreSQL database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("connect", () => {
  console.log("Connected to Render PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("PostgreSQL connection error:", err);
});

console.log("Database config loaded - Using PostgreSQL with Render");

module.exports = pool;
