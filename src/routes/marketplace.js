const express = require("express");

const router = express.Router();

const pool = require("../db");

const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

const {
  createGigsbergListing,
} = require("../services/integrations/gigsberg/gigsbergListings");

/**
 * GET /api/marketplace/listings
 * Recupera tutti i marketplace listings con dati ticket/evento.
 */
router.get(
  "/listings",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          ml.*,

          tickets.price AS base_price,
          tickets.partner_price,
          tickets.quantity,
          tickets.available_quantity,
          tickets.category,
          tickets.block,
          tickets.row_name,
          tickets.seat_from,
          tickets.seat_to,
          tickets.status AS ticket_status,

          events.name AS event_name,
          events.event_date,
          events.city,
          events.venue,
          events.country,
          events.team_name
        FROM marketplace_listings ml
        LEFT JOIN tickets
          ON tickets.id = ml.ticket_id
        LEFT JOIN events
          ON events.id = tickets.event_id
        ORDER BY ml.id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("Errore GET /api/marketplace/listings:", error);

      res.status(500).json({
        error: "Errore recupero marketplace listings",
      });
    }
  },
);

/**
 * PATCH /api/marketplace/listings/:id/pricing
 * Aggiorna pricing e repricing settings per singolo marketplace listing.
 */
router.patch(
  "/listings/:id/pricing",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        marketplace_price,
        min_price,
        auto_reprice_enabled,
        undercut_amount,
        last_market_price,
      } = req.body;

      const result = await pool.query(
        `
        UPDATE marketplace_listings
        SET
          marketplace_price = COALESCE($1, marketplace_price),
          min_price = COALESCE($2, min_price),
          auto_reprice_enabled = COALESCE($3, auto_reprice_enabled),
          undercut_amount = COALESCE($4, undercut_amount),
          last_market_price = COALESCE($5, last_market_price),
          last_sync_at = NOW()
        WHERE id = $6
        RETURNING *
        `,
        [
          marketplace_price,
          min_price,
          auto_reprice_enabled,
          undercut_amount,
          last_market_price,
          id,
        ],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Marketplace listing non trovato",
        });
      }

      res.json({
        message: "Marketplace pricing aggiornato correttamente",
        listing: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Errore PATCH /api/marketplace/listings/:id/pricing:",
        error,
      );

      res.status(500).json({
        error: "Errore aggiornamento marketplace pricing",
      });
    }
  },
);

/**
 * POST /api/marketplace/publish
 * Pubblica un ticket su un marketplace.
 */
router.post(
  "/publish",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { ticket_id, marketplace } = req.body;

      if (!ticket_id || !marketplace) {
        return res.status(400).json({
          error: "ticket_id e marketplace sono obbligatori",
        });
      }

      const normalizedMarketplace = String(marketplace).toLowerCase();

      const ticketResult = await pool.query(
        `
        SELECT *
        FROM tickets
        WHERE id = $1
        `,
        [ticket_id],
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({
          error: "Ticket non trovato",
        });
      }

      const ticket = ticketResult.rows[0];

      const existing = await pool.query(
        `
        SELECT *
        FROM marketplace_listings
        WHERE ticket_id = $1
        AND marketplace = $2
        `,
        [ticket_id, normalizedMarketplace],
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: "Ticket già presente per questo marketplace",
          listing: existing.rows[0],
        });
      }

      const initialMarketplacePrice = Number(
        ticket.marketplace_price || ticket.partner_price || ticket.price || 0,
      );

      let externalListingId = null;
      let externalEventId = null;
      let externalCategoryId = null;
      let syncStatus = "pending";
      let lastError = null;
      let responsePayload = null;

      if (normalizedMarketplace === "gigsberg") {
        try {
          const gigsbergResult = await createGigsbergListing(ticket_id);

          responsePayload = gigsbergResult?.response || null;

          externalListingId =
            gigsbergResult?.response?.id ||
            gigsbergResult?.response?.listing_id ||
            gigsbergResult?.response?.data?.id ||
            gigsbergResult?.response?.data?.listing_id ||
            null;

          externalEventId = gigsbergResult?.gigsberg_event_id || null;

          externalCategoryId = gigsbergResult?.gigsberg_category_id || null;

          syncStatus = "published";
        } catch (publishError) {
          console.error(
            "Errore publish reale Gigsberg:",
            publishError.response?.data || publishError.message,
          );

          syncStatus = "failed";

          lastError =
            publishError.response?.data?.error ||
            publishError.response?.data?.message ||
            publishError.message ||
            "Errore publish Gigsberg";

          responsePayload = publishError.response?.data || null;
        }
      } else if (normalizedMarketplace === "ticombo") {
        syncStatus = "pending";
        lastError =
          "Ticombo connector non ancora attivo: listing creato in coda locale";
      } else {
        syncStatus = "pending";
      }

      const insert = await pool.query(
        `
        INSERT INTO marketplace_listings (
          ticket_id,
          marketplace,
          marketplace_price,
          min_price,
          undercut_amount,
          auto_reprice_enabled,
          external_listing_id,
          external_event_id,
          external_category_id,
          remote_listing_id,
          remote_event_id,
          remote_category_id,
          sync_status,
          last_error,
          last_sync_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW()
        )
        RETURNING *
        `,
        [
          ticket_id,
          normalizedMarketplace,
          initialMarketplacePrice,
          ticket.min_price,
          ticket.undercut_amount || 0.01,
          false,
          externalListingId,
          externalEventId,
          externalCategoryId,
          externalListingId,
          externalEventId,
          externalCategoryId,
          syncStatus,
          lastError,
        ],
      );

      await pool.query(
        `
        INSERT INTO marketplace_sync_logs (
          marketplace_listing_id,
          ticket_id,
          marketplace,
          action,
          status,
          response_payload,
          error_message
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          insert.rows[0].id,
          ticket_id,
          normalizedMarketplace,
          "publish",
          syncStatus,
          responsePayload,
          lastError,
        ],
      );

      if (syncStatus === "failed") {
        return res.status(500).json({
          error: lastError || "Publish marketplace fallito",
          listing: insert.rows[0],
        });
      }

      res.status(201).json({
        message:
          syncStatus === "published"
            ? "Listing pubblicato correttamente"
            : "Publish marketplace messo in coda",
        listing: insert.rows[0],
      });
    } catch (error) {
      console.error("Errore POST /api/marketplace/publish:", error);

      res.status(500).json({
        error: "Errore publish marketplace",
      });
    }
  },
);

/**
 * GET /api/marketplace/logs
 * Recupera sync logs
 */
router.get("/logs", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT
          marketplace_sync_logs.*,
          tickets.supplier_ticket_id,
          events.name AS event_name
        FROM marketplace_sync_logs
        LEFT JOIN tickets
          ON tickets.id = marketplace_sync_logs.ticket_id
        LEFT JOIN events
          ON events.id = tickets.event_id
        ORDER BY marketplace_sync_logs.id DESC
        LIMIT 300
      `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/marketplace/logs:", error);

    res.status(500).json({
      error: "Errore recupero marketplace logs",
    });
  }
});

module.exports = router;
