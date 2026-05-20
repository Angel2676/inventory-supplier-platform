const express = require("express");

const router = express.Router();

const pool = require("../db");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

/**
 * GET /api/analytics/overview
 * Accesso consentito a:
 * - super_admin
 * - finance
 * - read_only_analyst
 */
router.get(
  "/overview",
  authJwt,
  requireRole("super_admin", "finance", "read_only_analyst"),
  async (req, res) => {
    try {
      const stockValue = await pool.query(`
        SELECT
          COALESCE(SUM(available_quantity * price), 0)::numeric(12,2)
            AS available_stock_value,
          COALESCE(SUM(quantity * price), 0)::numeric(12,2)
            AS total_stock_value
        FROM tickets
        WHERE status != 'deleted'
      `);

      const confirmedValue = await pool.query(`
        SELECT
          COALESCE(SUM(reservations.quantity * tickets.price), 0)::numeric(12,2)
            AS confirmed_value
        FROM reservations
        JOIN tickets ON tickets.id = reservations.ticket_id
        WHERE reservations.status = 'confirmed'
      `);

      const requestStats = await pool.query(`
        SELECT
          COUNT(*)::int AS total_requests,
          COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_requests,
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_requests,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected_requests,
          ROUND(
            (
              COUNT(*) FILTER (WHERE status = 'approved')::numeric
              / NULLIF(COUNT(*), 0)
            ) * 100,
            2
          ) AS approval_rate
        FROM ticket_requests
      `);

      const lowStockCount = await pool.query(`
        SELECT COUNT(*)::int AS low_stock_count
        FROM tickets
        WHERE status = 'available'
        AND available_quantity <= low_stock_threshold
      `);

      const topEvents = await pool.query(`
        SELECT
          events.id,
          events.name,
          events.venue,
          events.city,
          events.country,
          events.event_date,
          COALESCE(SUM(tickets.available_quantity * tickets.price), 0)::numeric(12,2)
            AS available_value,
          COALESCE(SUM(tickets.quantity), 0)::int
            AS total_quantity,
          COALESCE(SUM(tickets.available_quantity), 0)::int
            AS available_quantity
        FROM events
        LEFT JOIN tickets
          ON tickets.event_id = events.id
          AND tickets.status != 'deleted'
        WHERE events.status != 'deleted'
        GROUP BY
          events.id,
          events.name,
          events.venue,
          events.city,
          events.country,
          events.event_date
        ORDER BY available_value DESC
        LIMIT 10
      `);

      const topPartners = await pool.query(`
        SELECT
          users.id,
          users.company_name,
          users.email,
          users.role,
          COUNT(ticket_requests.id)::int AS requests_count,
          COUNT(ticket_requests.id)
            FILTER (WHERE ticket_requests.status = 'approved')::int
            AS approved_count,
          COUNT(ticket_requests.id)
            FILTER (WHERE ticket_requests.status = 'pending')::int
            AS pending_count,
          COUNT(ticket_requests.id)
            FILTER (WHERE ticket_requests.status = 'rejected')::int
            AS rejected_count
        FROM users
        LEFT JOIN ticket_requests
          ON ticket_requests.user_id = users.id
        WHERE users.role != 'super_admin'
        GROUP BY
          users.id,
          users.company_name,
          users.email,
          users.role
        ORDER BY requests_count DESC
        LIMIT 10
      `);

      res.json({
        stock: stockValue.rows[0],
        confirmed: confirmedValue.rows[0],
        requests: requestStats.rows[0],
        low_stock: lowStockCount.rows[0],
        top_events: topEvents.rows,
        top_partners: topPartners.rows
      });
    } catch (error) {
      console.error("Errore GET /api/analytics/overview:", error);

      res.status(500).json({
        error: "Errore recupero analytics"
      });
    }
  }
);

module.exports = router;