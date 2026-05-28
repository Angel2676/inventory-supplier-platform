const express = require("express");

const router = express.Router();
const pool = require("../db");

const {
  decreaseInventoryAndMarkMarketplaces,
} = require("../services/inventorySyncService");

/**
 * POST /api/webhooks/marketplace-sale
 *
 * Payload generico:
 * {
 *   "marketplace": "ticombo",
 *   "remote_listing_id": "12345",
 *   "quantity": 1,
 *   "order_id": "ORD-123"
 * }
 */
router.post("/marketplace-sale", async (req, res) => {
  try {
    const {
      marketplace,
      remote_listing_id,
      external_listing_id,
      quantity,
      order_id,
    } = req.body;

    if (!marketplace || !quantity) {
      return res.status(400).json({
        error: "marketplace e quantity sono obbligatori",
      });
    }

    const listingResult = await pool.query(
      `
      SELECT *
      FROM marketplace_listings
      WHERE marketplace = $1
        AND (
          remote_listing_id = $2
          OR external_listing_id = $2
          OR remote_listing_id = $3
          OR external_listing_id = $3
        )
      LIMIT 1
      `,
      [
        String(marketplace).toLowerCase(),
        remote_listing_id || null,
        external_listing_id || null,
      ],
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Marketplace listing non trovato",
      });
    }

    const listing = listingResult.rows[0];
    const eventResult = await pool.query(
      `
        SELECT events.name AS event_name
        FROM events
        JOIN tickets ON tickets.event_id = events.id
        WHERE tickets.id = $1
        `,
      [listing.ticket_id],
    );
    const eventName = eventResult.rows[0]?.event_name || null;

    const result = await decreaseInventoryAndMarkMarketplaces({
      ticketId: listing.ticket_id,
      quantity: Number(quantity),
      source: "marketplace_sale",
      marketplace: String(marketplace).toLowerCase(),
      referenceId: order_id || remote_listing_id || external_listing_id,
    });

    await pool.query(
      `
        INSERT INTO marketplace_orders (
            marketplace,
            marketplace_order_id,
            marketplace_listing_id,
            ticket_id,
            event_name,
            quantity,
            total_amount,
            currency,
            order_status,
            fulfillment_status,
            raw_payload
            )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
      [
        String(marketplace).toLowerCase(),
        order_id || null,
        listing.id,
        listing.ticket_id,
        eventName,
        Number(quantity),
        req.body.total_amount || null,
        req.body.currency || "EUR",
        req.body.order_status || "paid",
        req.body.fulfillment_status || "pending",
        req.body,
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
        listing.id,
        listing.ticket_id,
        String(marketplace).toLowerCase(),
        "marketplace_sale_received",
        "processed",
        req.body,
        null,
      ],
    );

    res.json({
      message: "Vendita marketplace ricevuta e inventory aggiornata",
      ticket: result.ticket,
      affected_marketplace_listings: result.affected_marketplace_listings,
    });
  } catch (error) {
    console.error("Errore webhook marketplace-sale:", error);

    res.status(500).json({
      error: error.message || "Errore gestione vendita marketplace",
    });
  }
});

module.exports = router;
