const pool = require("../db");

async function createAuditLog({
  client_id,
  action,
  resource_type,
  resource_id,
  metadata = {}
}) {

  try {

    await pool.query(
      `
      INSERT INTO audit_logs (
        client_id,
        action,
        resource_type,
        resource_id,
        metadata
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )
      `,
      [
        client_id,
        action,
        resource_type,
        resource_id,
        metadata
      ]
    );

  } catch (error) {

    console.error("Errore audit log:", error);
  }
}

module.exports = createAuditLog;