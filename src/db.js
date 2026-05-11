const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
connectionString: process.env.DATABASE_URL
});

pool.connect((err) => {
if (err) {
console.error("Errore connessione PostgreSQL:", err);
} else {
console.log("PostgreSQL connected successfully");
}
});

module.exports = pool;
