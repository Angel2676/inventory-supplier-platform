const express = require("express");

const router = express.Router();

const pool = require("../db");
const authJwt = require("../middleware/authJwt");

/**
 * GET notifications
 */
router.get("/", authJwt, async (req, res) => {
  try {
    let query = `
      SELECT *
      FROM notifications
      WHERE
    `;

    const values = [];

    if (req.user.role === "super_admin") {
      query += `
        role_target = 'super_admin'
        OR user_id = $1
      `;

      values.push(req.user.id);
    } else {
      query += `
        user_id = $1
      `;

      values.push(req.user.id);
    }

    query += `
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/notifications:", error);

    res.status(500).json({
      error: "Errore recupero notifiche"
    });
  }
});

/**
 * MARK AS READ
 */
router.patch("/:id/read", authJwt, async (req, res) => {
  try {
    const result = await pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Notifica non trovata"
      });
    }

    res.json({
      message: "Notifica aggiornata",
      notification: result.rows[0]
    });
  } catch (error) {
    console.error("Errore PATCH /api/notifications/:id/read:", error);

    res.status(500).json({
      error: "Errore aggiornamento notifica"
    });
  }
});

module.exports = router;