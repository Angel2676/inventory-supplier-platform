const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

async function testConnection() {
  let client;

  try {
    client = await pool.connect();
    console.log("PostgreSQL connected successfully");
  } catch (err) {
    console.error("PostgreSQL connection error:", err);
  } finally {
    if (client) client.release();
  }
}

testConnection();

module.exports = pool;
