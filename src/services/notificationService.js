const pool = require("../db");

async function createNotification({
  user_id = null,
  role_target = null,
  type,
  title,
  message = "",
  metadata = {}
}) {
  try {
    await pool.query(
      `
      INSERT INTO notifications (
        user_id,
        role_target,
        type,
        title,
        message,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        user_id,
        role_target,
        type,
        title,
        message,
        metadata
      ]
    );
  } catch (error) {
    console.error("Errore createNotification:", error);
  }
}

module.exports = {
  createNotification
};