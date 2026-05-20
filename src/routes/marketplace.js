const express = require("express");
const pool = require("../db");

const {
  createGigsbergListing
} = require("../services/integrations/gigsberg/gigsbergListings");

const {
  searchSportEvents365Events,
  createSupplierTickets
} = require("../services/integrations/sportevents365/sportevents365Api");

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
      error: "Errore caricamento marketplace listings"
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
        error: "Marketplace mancante"
      });
    }

    if (!keyword) {
      return res.status(400).json({
        error: "Keyword evento mancante"
      });
    }

    let results = [];

    if (marketplace === "sportevents365") {
      results = await searchSportEvents365Events({ keyword });
    }

    if (marketplace === "gigsberg") {
      results = [];
    }

    if (marketplace === "ticombo") {
      results = [];
    }

    return res.json({
      results
    });
  } catch (error) {
    console.error("Errore ricerca eventi marketplace:", error);

    return res.status(500).json({
      error: error.message || "Errore ricerca eventi marketplace"
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
      error: "Errore caricamento marketplace mappings"
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
      is_active
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
        is_active !== false
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore creazione marketplace mapping:", error);

    res.status(500).json({
      error: error.message || "Errore creazione marketplace mapping"
    });
  }
});

router.patch("/mappings/:id", async (req, res) => {
  try {
    const { id } = req.params;

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
      is_active
    } = req.body;

    const result = await pool.query(
      `
      UPDATE marketplace_mappings
      SET
        marketplace = $1,
        mapping_type = $2,
        internal_event_id = $3,
        internal_category = $4,
        internal_block = $5,
        remote_event_id = $6,
        remote_event_name = $7,
        remote_category_id = $8,
        remote_category_name = $9,
        remote_block_id = $10,
        remote_block_name = $11,
        notes = $12,
        is_active = $13,
        updated_at = NOW()
      WHERE id = $14
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
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore aggiornamento marketplace mapping:", error);

    res.status(500).json({
      error: error.message || "Errore aggiornamento marketplace mapping"
    });
  }
});

router.delete("/mappings/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM marketplace_mappings WHERE id = $1", [
      req.params.id
    ]);

    res.json({
      success: true
    });
  } catch (error) {
    console.error("Errore eliminazione marketplace mapping:", error);

    res.status(500).json({
      error: "Errore eliminazione marketplace mapping"
    });
  }
});

/**
 * MARKETPLACE LOGS
 */
router.get("/logs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM marketplace_sync_logs
      ORDER BY created_at DESC
      LIMIT 200
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore caricamento marketplace logs:", error);

    res.status(500).json({
      error: "Errore caricamento marketplace logs"
    });
  }
});

/**
 * MARKETPLACE ORDERS
 */
router.get("/orders", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM marketplace_orders
      ORDER BY created_at DESC
      LIMIT 200
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore caricamento marketplace orders:", error);

    res.status(500).json({
      error: "Errore caricamento marketplace orders"
    });
  }
});

/**
 * MARKETPLACE SETTINGS
 */
router.get("/settings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM marketplace_settings
      ORDER BY marketplace ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore caricamento marketplace settings:", error);

    res.status(500).json({
      error: "Errore caricamento marketplace settings"
    });
  }
});

router.patch("/settings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      is_active,
      environment,
      default_markup_percentage,
      default_undercut_amount,
      auto_publish_enabled,
      auto_reprice_enabled
    } = req.body;

    const result = await pool.query(
      `
      UPDATE marketplace_settings
      SET
        is_active = COALESCE($1, is_active),
        environment = COALESCE($2, environment),
        default_markup_percentage = COALESCE($3, default_markup_percentage),
        default_undercut_amount = COALESCE($4, default_undercut_amount),
        auto_publish_enabled = COALESCE($5, auto_publish_enabled),
        auto_reprice_enabled = COALESCE($6, auto_reprice_enabled),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
      `,
      [
        is_active,
        environment,
        default_markup_percentage,
        default_undercut_amount,
        auto_publish_enabled,
        auto_reprice_enabled,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore aggiornamento marketplace settings:", error);

    res.status(500).json({
      error: "Errore aggiornamento marketplace settings"
    });
  }
});

/**
 * RETRY SYNC
 */
router.post("/listings/:id/retry", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE marketplace_listings
      SET
        sync_status = 'needs_sync',
        last_error = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    res.json({
      success: true,
      listing: result.rows[0]
    });
  } catch (error) {
    console.error("Errore retry marketplace listing:", error);

    res.status(500).json({
      error: "Errore retry marketplace listing"
    });
  }
});

/**
 * PUBLISH MARKETPLACE LISTING
 */
router.post("/publish", async (req, res) => {
  try {
    const { ticket_id, marketplace } = req.body;

    if (!ticket_id || !marketplace) {
      return res.status(400).json({
        error: "ticket_id e marketplace sono obbligatori"
      });
    }

    const normalizedMarketplace = String(marketplace).toLowerCase();

    /**
     * GIGSBERG
     */
    if (normalizedMarketplace === "gigsberg") {
      try {
        const gigsbergResult = await createGigsbergListing(ticket_id);

        return res.json({
          success: true,
          message: "Publish Gigsberg avviato",
          result: gigsbergResult
        });
      } catch (error) {
        console.error("Errore publish reale Gigsberg:", error);

        return res.status(500).json({
          error: error.message || "Errore publish Gigsberg"
        });
      }
    }

    /**
     * TICOMBO PLACEHOLDER
     */
    if (normalizedMarketplace === "ticombo") {
      const listingResult = await pool.query(
        `
        INSERT INTO marketplace_listings (
          ticket_id,
          marketplace,
          sync_status,
          sync_direction,
          last_sync_at
        )
        VALUES ($1,$2,$3,$4,NOW())
        RETURNING *
        `,
        [
          ticket_id,
          "ticombo",
          "pending",
          "inventory_to_marketplace"
        ]
      );

      return res.json({
        success: true,
        message: "Publish Ticombo placeholder creato",
        listing: listingResult.rows[0]
      });
    }

    /**
     * SPORTSEVENTS365 REAL PUBLISH
     */
    if (normalizedMarketplace === "sportevents365") {
      const ticketResult = await pool.query(
        `
        SELECT 
          t.*,
          e.name AS event_name
        FROM tickets t
        JOIN events e ON e.id = t.event_id
        WHERE t.id = $1
        `,
        [ticket_id]
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({
          error: "Ticket non trovato"
        });
      }

      const ticket = ticketResult.rows[0];
      const existingListingResult = await pool.query(
        `
        SELECT *
        FROM marketplace_listings
        WHERE ticket_id = $1
          AND marketplace = 'sportevents365'
          AND sync_status = 'synced'
          AND remote_listing_id IS NOT NULL
        LIMIT 1
        `,
        [ticket_id]
      );

      if (existingListingResult.rows.length > 0) {
        return res.status(400).json({
          error: "Ticket già pubblicato su SportEvents365",
          listing: existingListingResult.rows[0]
        });
      }



      const eventMappingResult = await pool.query(
        `
        SELECT *
        FROM marketplace_mappings
        WHERE marketplace = 'sportevents365'
          AND mapping_type = 'event'
          AND internal_event_id = $1
          AND is_active = true
        LIMIT 1
        `,
        [ticket.event_id]
      );

      if (eventMappingResult.rows.length === 0) {
        return res.status(400).json({
          error: "Mapping evento SportEvents365 mancante"
        });
      }

      const eventMapping = eventMappingResult.rows[0];

      const categoryMappingResult = await pool.query(
        `
        SELECT *
        FROM marketplace_mappings
        WHERE marketplace = 'sportevents365'
          AND mapping_type = 'category'
          AND internal_event_id = $1
          AND internal_category = $2
          AND is_active = true
        LIMIT 1
        `,
        [ticket.event_id, ticket.category]
      );

      if (categoryMappingResult.rows.length === 0) {
        return res.status(400).json({
          error: `Mapping categoria SportEvents365 mancante per ${ticket.category}`
        });
      }

      const categoryMapping = categoryMappingResult.rows[0];

      const sportEventsPayload = [
        {
          categoryId: Number(categoryMapping.remote_category_id),
          quantity: Number(ticket.available_quantity || 1),
          price: Number(
            ticket.marketplace_price ||
              ticket.partner_price ||
              ticket.price ||
              0
          ),
          currency: "EUR",
          shippingMethodId: 1006,
          sittingArrangementId: 5,
          sellingLimitations: [],
          restrictions: [],
          notes: ticket.block || ""
        }
      ];

     let publishResponse;

try {
  publishResponse = await createSupplierTickets(
    eventMapping.remote_event_id,
    sportEventsPayload
  );
} catch (publishError) {
  const failedListingResult = await pool.query(
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
      "sportevents365",
      eventMapping.remote_event_id,
      categoryMapping.remote_category_id,
      eventMapping.remote_event_id,
      categoryMapping.remote_category_id,
      "failed",
      "inventory_to_marketplace",
      Number(
        ticket.marketplace_price ||
          ticket.partner_price ||
          ticket.price ||
          0
      ),
      publishError.response?.data
        ? JSON.stringify(publishError.response.data)
        : publishError.message
    ]
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
      failedListingResult.rows[0].id,
      ticket.id,
      "sportevents365",
      "publish",
      "failed",
      publishError.response?.data || null,
      publishError.message
    ]
  );

  return res.status(500).json({
    error: "Publish SportEvents365 fallito",
    details: publishError.response?.data || publishError.message
  });
}
    console.log(

      "SPORTSEVENTS365 PUBLISH RESPONSE:",

      JSON.stringify(publishResponse, null, 2)

    );
      

      const remoteListingId =
        publishResponse?.data?.tickets?.[0] || null;
      

      const listingResult = await pool.query(
        `
        INSERT INTO marketplace_listings (
          ticket_id,
          marketplace,
          external_event_id,
          external_category_id,
          remote_event_id,
          remote_category_id,
          remote_listing_id,
          sync_status,
          sync_direction,
          last_sync_at,
          marketplace_price,
          last_error
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11)
        RETURNING *
        `,
        [
          ticket.id,
          "sportevents365",
          eventMapping.remote_event_id,
          categoryMapping.remote_category_id,
          eventMapping.remote_event_id,
          categoryMapping.remote_category_id,
          remoteListingId,
          "synced",
          "inventory_to_marketplace",
          Number(
            ticket.marketplace_price ||
              ticket.partner_price ||
              ticket.price ||
              0
          ),
          null
        ]
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
          "sportevents365",
          "publish",
          "synced",
          publishResponse,
          null
        ]
      );

      return res.json({
        success: true,
        message: "Ticket pubblicato su SportEvents365",
        listing: listingResult.rows[0],
        response: publishResponse
      });
    }

    return res.status(400).json({
      error: `Marketplace non supportato: ${marketplace}`
    });
  } catch (error) {
    console.error("Errore publish marketplace:", error);

    return res.status(500).json({
      error: error.message || "Errore publish marketplace"
    });
  }
});

module.exports = router;