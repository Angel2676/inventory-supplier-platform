const { Pool } = require("pg");

const isRender =
  process.env.RENDER === "true" ||
  process.env.NODE_ENV === "production";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const pool = new Pool(
  hasDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isRender
          ? {
              rejectUnauthorized: false
            }
          : false
      }
    : {
        user: process.env.DB_USER || "postgres",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "inventory_supplier",
        password: process.env.DB_PASSWORD || "",
        port: Number(process.env.DB_PORT || 5432)
      }
);

pool
  .connect()
  .then(() => {
    console.log("PostgreSQL connected successfully");
  })
  .catch((err) => {
    console.error("PostgreSQL connection error:", err);
  });

module.exports = pool;