const express = require("express");
const pool = require("../db");

const {
  autoDelistSportEvents365Listing,
  autoDelistTicomboListing,
  autoDelistGigsbergListing,
} = require("../services/marketplaceQuantitySyncService");

const {
  publishTicomboTicket,
} = require("../services/integrations/ticombo/ticomboPublishService");

const router = express.Router();

function normalizeMarketplace(value) {
  const v = String(value || "").toLowerCase().trim();

  if (["g", "gigsberg"].includes(v)) return "gigsberg";
  if (["t", "ticombo"].includes(v)) return "ticombo";
  if (["s", "sportevents365", "sport365"].includes(v)) return "sportevents365";

  throw new Error(`Marketplace non valido: ${value}`);
}

async function publishTicket(ticketId, marketplace) {
  if (marketplace === "ticombo") {
    return publishTicomboTicket(ticketId);
  }

  throw new Error(
    `Publish toggle non collegato per ${marketplace}. Usa per ora la rotta publish già esistente della dashboard.`,
  );
}

async function delistListing(listing, marketplace) {
  if (marketplace === "ticombo") {
    return autoDelistTicomboListing(listing);
  }

  if (marketplace === "gigsberg") {
    return autoDelistGigsbergListing(listing);
  }

  if (marketplace === "sportevents365") {
    return autoDelistSportEvents365Listing(listing);
  }

  throw new Error(`Delist non supportato per marketplace ${marketplace}`);
}

router.post("/tickets/:ticketId/toggle-marketplace", async (req, res) => {
  const client = await pool.connect();

  try {
    const ticketId = Number(req.params.ticketId);
    const marketplace = normalizeMarketplace(req.body.marketplace);

    if (!Number.isInteger(ticketId)) {
      return res.status(400).json({ ok: false, error: "ticketId non valido" });
    }

    const active = await client.query(
      `
      SELECT *
      FROM marketplace_listings
      WHERE ticket_id = $1
        AND marketplace = $2
        AND COALESCE(sync_status, '') NOT IN ('delisted', 'deleted', 'cancelled', 'failed')
      ORDER BY id DESC
      LIMIT 1
      `,
      [ticketId, marketplace],
    );

    if (active.rows.length > 0) {
      const listing = active.rows[0];

      const responsePayload = await delistListing(listing, marketplace);

      await client.query(
        `
        UPDATE marketplace_listings
        SET sync_status = 'delisted',
            last_sync_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [listing.id],
      );

      return res.json({
        ok: true,
        action: "delisted",
        ticket_id: ticketId,
        marketplace,
        listing_id: listing.id,
        responsePayload,
      });
    }

    const publishResponse = await publishTicket(ticketId, marketplace);

    return res.json({
      ok: true,
      action: "published",
      ticket_id: ticketId,
      marketplace,
      publishResponse,
    });
  } catch (error) {
    console.error("Toggle marketplace error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
