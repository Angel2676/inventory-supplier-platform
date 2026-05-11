const express = require("express");

const router = express.Router();

const pool = require("../db");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

router.get("/low-stock", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        tickets.id,
        tickets.event_id,
        events.name AS event_name,
        tickets.supplier_ticket_id,
        tickets.category,
        tickets.block,
        tickets.quantity,
        tickets.available_quantity,
        tickets.low_stock_threshold,
        tickets.price,
        tickets.currency,
        tickets.status
      FROM tickets
      JOIN events ON events.id = tickets.event_id
      WHERE tickets.status = 'available'
      AND tickets.available_quantity <= tickets.low_stock_threshold
      ORDER BY tickets.available_quantity ASC, tickets.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/inventory-alerts/low-stock:", error);

    res.status(500).json({
      error: "Errore recupero low stock alerts"
    });
  }
});

module.exports = router;