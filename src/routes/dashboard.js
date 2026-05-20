const express = require("express");

const router = express.Router();

const pool = require("../db");

const authJwt = require("../middleware/authJwt");

/**
 * Dashboard statistics
 */
router.get("/stats", authJwt, async (req, res) => {
  try {

    /**
     * Eventi
     */
    const eventsResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total_events
      FROM events
    `);

    /**
     * Tickets
     */
    const ticketsResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total_tickets,

        COALESCE(
          SUM(available_quantity),
          0
        )::int AS available_quantity,

        COALESCE(
          SUM(
            available_quantity * price
          ),
          0
        )::numeric(12,2)
        AS available_stock_value

      FROM tickets
      WHERE status != 'deleted'
    `);

    /**
     * Reservations
     */
    const reservationsResult = await pool.query(`
      SELECT

        COUNT(*) FILTER (
          WHERE status = 'reserved'
        )::int AS reserved_count,

        COUNT(*) FILTER (
          WHERE status = 'confirmed'
        )::int AS confirmed_count,

        COUNT(*) FILTER (
          WHERE status = 'expired'
        )::int AS expired_count

      FROM reservations
    `);

    /**
     * Ticket requests
     */
    const ticketRequestsResult = await pool.query(`
      SELECT

        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::int AS pending_count,

        COUNT(*) FILTER (
          WHERE status = 'approved'
        )::int AS approved_count,

        COUNT(*) FILTER (
          WHERE status = 'rejected'
        )::int AS rejected_count

      FROM ticket_requests
    `);

    res.json({
      events: eventsResult.rows[0],
      tickets: ticketsResult.rows[0],
      reservations: reservationsResult.rows[0],
      ticket_requests: ticketRequestsResult.rows[0]
    });

  } catch (error) {
    console.error(
      "Errore GET /api/dashboard/stats:",
      error
    );

    res.status(500).json({
      error:
        "Errore caricamento statistiche dashboard"
    });
  }
});

module.exports = router;