const express = require("express");
const pool = require("../db");

const {
  createGigsbergListing,
} = require("../services/integrations/gigsberg/gigsbergListings");

const {
  searchSportEvents365Events,
  createSupplierTickets,
} = require("../services/integrations/sportevents365/sportevents365Api");

const {
  searchTicomboEvents,
} = require("../services/integrations/ticombo/ticomboEvents");

const router = express.Router();

/**
 * LIST MARKETPLACE LISTINGS
 */
router.get("/listings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        ml.*,
        t.category,
        t.block,
        t.available_quantity,
        t.price,
        e.name AS event_name
      FROM marketplace_listings ml
      LEFT JOIN tickets t ON t.id = ml.ticket_id
      LEFT JOIN events e ON e.id = t.event_id
      ORDER BY ml.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore caricamento marketplace listings:", error);

    res.status(500).json({
      error: "Errore caricamento marketplace listings",
    });
  }
});

/**
 * MARKETPLACE REMOTE EVENT SEARCH
 */
router.get("/search-events", async (req, res) => {
  try {
    const marketplace = String(req.query.marketplace || "").toLowerCase();

    const keyword = String(req.query.keyword || "").trim();

    if (!marketplace) {
      return res.status(400).json({
        error: "Marketplace mancante",
      });
    }

    if (!keyword) {
      return res.status(400).json({
        error: "Keyword evento mancante",
      });
    }

    let results = [];

    /**
     * SPORTSEVENTS365
     */
    if (marketplace === "sportevents365") {
      results = await searchSportEvents365Events({
        keyword,
      });
    } else if (marketplace === "ticombo") {
      /**
       * TICOMBO
       */
      results = await searchTicomboEvents(keyword);
    } else if (marketplace === "gigsberg") {
      /**
       * GIGSBERG
       */
      results = [];
    } else {
      /**
       * UNKNOWN MARKETPLACE
       */
      return res.status(400).json({
        error: `Marketplace non supportato: ${marketplace}`,
      });
    }

    return res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Errore ricerca eventi marketplace:", error);

    return res.status(500).json({
      error:
        error.response?.data ||
        error.message ||
        "Errore ricerca eventi marketplace",
    });
  }
});

/**
 * MARKETPLACE MAPPINGS
 */
router.get("/mappings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        mm.*,
        e.name AS internal_event_name
      FROM marketplace_mappings mm
      LEFT JOIN events e ON e.id = mm.internal_event_id
      ORDER BY mm.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore caricamento marketplace mappings:", error);

    res.status(500).json({
      error: "Errore caricamento marketplace mappings",
    });
  }
});

router.post("/mappings", async (req, res) => {
  try {
    const {
      marketplace,
      mapping_type,
      internal_event_id,
      internal_category,
      internal_block,
      remote_event_id,
      remote_event_name,
      remote_category_id,
      remote_category_name,
      remote_block_id,
      remote_block_name,
      notes,
      is_active,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO marketplace_mappings (
        marketplace,
        mapping_type,
        internal_event_id,
        internal_category,
        internal_block,
        remote_event_id,
        remote_event_name,
        remote_category_id,
        remote_category_name,
        remote_block_id,
        remote_block_name,
        notes,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
      `,
      [
        marketplace,
        mapping_type,
        internal_event_id || null,
        internal_category || null,
        internal_block || null,
        remote_event_id || null,
        remote_event_name || null,
        remote_category_id || null,
        remote_category_name || null,
        remote_block_id || null,
        remote_block_name || null,
        notes || null,
        is_active !== false,
      ],
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore creazione marketplace mapping:", error);

    res.status(500).json({
      error: error.message || "Errore creazione marketplace mapping",
    });
  }
});
/**
 * PUBLISH MARKETPLACE LISTING - TICOMBO PREPARATORY
 */
router.post("/publish", async (req, res) => {
  try {
    const { ticket_id, marketplace } = req.body;

    if (!ticket_id || !marketplace) {
      return res.status(400).json({
        error: "ticket_id e marketplace sono obbligatori",
      });
    }

    const normalizedMarketplace = String(marketplace).toLowerCase();

    if (normalizedMarketplace !== "ticombo") {
      return res.status(400).json({
        error:
          "In questo file attuale è attivo solo il publish preparatorio Ticombo. SportEvents365/Gigsberg vanno ripristinati dal file precedente.",
      });
    }

    const ticketResult = await pool.query(
      `
      SELECT 
        t.*,
        e.name AS event_name
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      WHERE t.id = $1
      `,
      [ticket_id],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        error: "Ticket non trovato",
      });
    }

    const ticket = ticketResult.rows[0];

    const existingListingResult = await pool.query(
      `
      SELECT *
      FROM marketplace_listings
      WHERE ticket_id = $1
        AND marketplace = 'ticombo'
        AND sync_status IN ('pending', 'synced')
      LIMIT 1
      `,
      [ticket_id],
    );

    if (existingListingResult.rows.length > 0) {
      return res.status(400).json({
        error: "Ticket già preparato/pubblicato su Ticombo",
        listing: existingListingResult.rows[0],
      });
    }

    const eventMappingResult = await pool.query(
      `
      SELECT *
      FROM marketplace_mappings
      WHERE marketplace = 'ticombo'
        AND mapping_type = 'event'
        AND internal_event_id = $1
        AND is_active = true
      LIMIT 1
      `,
      [ticket.event_id],
    );

    if (eventMappingResult.rows.length === 0) {
      return res.status(400).json({
        error: "Mapping evento Ticombo mancante",
      });
    }

    const eventMapping = eventMappingResult.rows[0];

    const categoryMappingResult = await pool.query(
      `
      SELECT *
      FROM marketplace_mappings
      WHERE marketplace = 'ticombo'
        AND mapping_type = 'category'
        AND internal_event_id = $1
        AND internal_category = $2
        AND is_active = true
      LIMIT 1
      `,
      [ticket.event_id, ticket.category],
    );

    if (categoryMappingResult.rows.length === 0) {
      return res.status(400).json({
        error: `Mapping categoria Ticombo mancante per ${ticket.category}`,
      });
    }

    const categoryMapping = categoryMappingResult.rows[0];

    const price = Number(
      ticket.marketplace_price || ticket.partner_price || ticket.price || 0,
    );

    const listingResult = await pool.query(
      `
      INSERT INTO marketplace_listings (
        ticket_id,
        marketplace,
        external_event_id,
        external_category_id,
        remote_event_id,
        remote_category_id,
        sync_status,
        sync_direction,
        last_sync_at,
        marketplace_price,
        last_error
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10)
      RETURNING *
      `,
      [
        ticket.id,
        "ticombo",
        eventMapping.remote_event_id,
        categoryMapping.remote_category_id,
        eventMapping.remote_event_id,
        categoryMapping.remote_category_id,
        "pending",
        "inventory_to_marketplace",
        price,
        null,
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
        listingResult.rows[0].id,
        ticket.id,
        "ticombo",
        "prepare_publish",
        "pending",
        {
          remote_event_id: eventMapping.remote_event_id,
          remote_category_id: categoryMapping.remote_category_id,
          remote_category_name: categoryMapping.remote_category_name,
          price,
          quantity: ticket.available_quantity,
        },
        null,
      ],
    );

    return res.json({
      success: true,
      message: "Publish Ticombo preparato correttamente",
      listing: listingResult.rows[0],
    });
  } catch (error) {
    console.error("Errore publish preparatorio Ticombo:", error);

    return res.status(500).json({
      error: error.message || "Errore publish preparatorio Ticombo",
    });
  }
});

module.exports = router;
