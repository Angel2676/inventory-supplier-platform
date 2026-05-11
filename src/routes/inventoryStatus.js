const express = require("express");

const router = express.Router();

const pool = require("../db");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

router.get("/", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        tickets.id,
        tickets.event_id,
        events.name AS event_name,
        tickets.supplier_ticket_id,
        tickets.category,
        tickets.block,
        tickets.quantity AS original_quantity,
        tickets.available_quantity,
        tickets.low_stock_threshold,
        tickets.price,
        tickets.currency,
        tickets.status,

        COALESCE(pending.pending_quantity, 0)::int AS pending_quantity,
        COALESCE(confirmed.confirmed_quantity, 0)::int AS confirmed_quantity,
        COALESCE(reserved.reserved_quantity, 0)::int AS reserved_quantity,

        (
          tickets.available_quantity
          - COALESCE(pending.pending_quantity, 0)
        )::int AS effective_available,

        ROUND(
          (
            (
              tickets.quantity - tickets.available_quantity
            )::numeric
            / NULLIF(tickets.quantity, 0)
          ) * 100,
          2
        ) AS utilization_percent

      FROM tickets

      JOIN events
        ON events.id = tickets.event_id

      LEFT JOIN (
        SELECT
          ticket_id,
          SUM(quantity) AS pending_quantity
        FROM ticket_requests
        WHERE status = 'pending'
        GROUP BY ticket_id
      ) pending
        ON pending.ticket_id = tickets.id

      LEFT JOIN (
        SELECT
          ticket_id,
          SUM(quantity) AS confirmed_quantity
        FROM reservations
        WHERE status = 'confirmed'
        GROUP BY ticket_id
      ) confirmed
        ON confirmed.ticket_id = tickets.id

      LEFT JOIN (
        SELECT
          ticket_id,
          SUM(quantity) AS reserved_quantity
        FROM reservations
        WHERE status = 'reserved'
        GROUP BY ticket_id
      ) reserved
        ON reserved.ticket_id = tickets.id

      WHERE tickets.status != 'deleted'

      ORDER BY utilization_percent DESC NULLS LAST, tickets.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/inventory-status:", error);

    res.status(500).json({
      error: "Errore recupero inventory status"
    });
  }
});

module.exports = router;