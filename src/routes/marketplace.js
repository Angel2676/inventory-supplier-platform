const express = require("express");

const router = express.Router();

const pool = require("../db");

const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

/**
 * GET marketplace listings
 */
router.get(
  "/listings",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          marketplace_listings.*,
          tickets.ticket_type,
          tickets.price,
          events.name AS event_name
        FROM marketplace_listings
        LEFT JOIN tickets
          ON tickets.id = marketplace_listings.ticket_id
        LEFT JOIN events
          ON events.id = tickets.event_id
        ORDER BY marketplace_listings.id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Errore recupero marketplace listings"
      });
    }
  }
);

/**
 * Publish ticket to marketplace
 */
router.post(
  "/publish",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const {
        ticket_id,
        marketplace
      } = req.body;

      if (!ticket_id || !marketplace) {
        return res.status(400).json({
          error: "ticket_id e marketplace obbligatori"
        });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM marketplace_listings
        WHERE ticket_id = $1
        AND marketplace = $2
        `,
        [ticket_id, marketplace]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: "Ticket già pubblicato su questo marketplace"
        });
      }

      const insert = await pool.query(
        `
        INSERT INTO marketplace_listings (
          ticket_id,
          marketplace,
          sync_status
        )
        VALUES ($1, $2, 'pending')
        RETURNING *
        `,
        [ticket_id, marketplace]
      );

      await pool.query(
        `
        INSERT INTO marketplace_sync_logs (
          marketplace_listing_id,
          ticket_id,
          marketplace,
          action,
          status
        )
        VALUES ($1, $2, $3, 'publish', 'pending')
        `,
        [
          insert.rows[0].id,
          ticket_id,
          marketplace
        ]
      );

      res.status(201).json({
        message: "Publish marketplace avviato",
        listing: insert.rows[0]
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Errore publish marketplace"
      });
    }
  }
);

module.exports = router;