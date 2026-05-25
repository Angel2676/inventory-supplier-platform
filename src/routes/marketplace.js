const express = require("express");
const pool = require("../db");

const {
  createGigsbergListing,
} = require("../services/integrations/gigsberg/gigsbergListings");

const {
  deleteListing: deleteGigsbergListing,
} = require("../services/integrations/gigsberg/gigsbergApi");

const {
  searchSportEvents365Events,
  createSupplierTickets,
} = require("../services/integrations/sportevents365/sportevents365Api");

const {
  searchTicomboEvents,
} = require("../services/integrations/ticombo/ticomboEvents");

const {
  createTicomboListing,
  deleteTicomboListing,
} = require("../services/integrations/ticombo/ticomboListings");

const router = express.Router();

const createAuditLog = require("../services/auditLogService");
const { calculateSafePrice } = require("../services/priceCheckerService");
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

        t.price AS base_price,
        t.partner_price,
        t.marketplace_price AS ticket_marketplace_price,
        
        e.name AS event_name,
        e.event_date
        
        FROM marketplace_listings ml

        LEFT JOIN tickets t
          ON t.id = ml.ticket_id

        LEFT JOIN events e
          ON e.id = t.event_id

        ORDER BY ml.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore caricamento marketplace listings:", error);
    res.status(500).json({ error: "Errore caricamento marketplace listings" });
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
      return res.status(400).json({ error: "Marketplace mancante" });
    }

    if (!keyword) {
      return res.status(400).json({ error: "Keyword evento mancante" });
    }

    let results = [];

    if (marketplace === "sportevents365") {
      results = await searchSportEvents365Events({ keyword });
    } else if (marketplace === "ticombo") {
      results = await searchTicomboEvents(keyword);
    } else if (marketplace === "gigsberg") {
      results = [];
    } else {
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
    res.status(500).json({ error: "Errore caricamento marketplace mappings" });
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

    await createAuditLog({
      client_id: null,
      action: "UPDATE_MARKETPLACE_SETTINGS",
      resource_type: "marketplace_settings",
      resource_id: marketplace,
      metadata: {
        updated_fields: req.body,
        marketplace,
      },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore creazione marketplace mapping:", error);
    res.status(500).json({
      error: error.message || "Errore creazione marketplace mapping",
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
      is_active,
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
        id,
      ],
    );

    await createAuditLog({
      client_id: null,
      action: "UPDATE_MARKETPLACE_SETTINGS",
      resource_type: "marketplace_settings",
      resource_id: marketplace,
      metadata: {
        updated_fields: req.body,
        marketplace,
      },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore aggiornamento marketplace mapping:", error);
    res.status(500).json({
      error: error.message || "Errore aggiornamento marketplace mapping",
    });
  }
});

router.delete("/mappings/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM marketplace_mappings WHERE id = $1", [
      req.params.id,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Errore eliminazione marketplace mapping:", error);
    res.status(500).json({ error: "Errore eliminazione marketplace mapping" });
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
    res.status(500).json({ error: "Errore caricamento marketplace logs" });
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
    res.status(500).json({ error: "Errore caricamento marketplace orders" });
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

    const settings = result.rows.map((setting) => {
      let apiConfigured = Boolean(setting.api_configured);

      if (setting.marketplace === "gigsberg") {
        apiConfigured = Boolean(
          process.env.GIGSBERG_API_KEY &&
          process.env.GIGSBERG_USER_ID &&
          process.env.GIGSBERG_ADDRESS_ID &&
          process.env.GIGSBERG_PRESENT_ADDRESS_ID,
        );
      }

      if (setting.marketplace === "ticombo") {
        apiConfigured = Boolean(
          process.env.TICOMBO_API_TOKEN ||
          process.env.TICOMBO_API_KEY ||
          process.env.TICOMBO_AUTH_TOKEN,
        );
      }

      if (setting.marketplace === "sportevents365") {
        apiConfigured = Boolean(
          process.env.SPORTSEVENTS365_API_KEY ||
          process.env.SPORTSEVENTS365_TOKEN,
        );
      }

      return {
        ...setting,
        api_configured: apiConfigured,
      };
    });

    res.json(settings);
  } catch (error) {
    console.error("Errore caricamento marketplace settings:", error);
    res.status(500).json({ error: "Errore caricamento marketplace settings" });
  }
});

router.patch("/settings/:id", async (req, res) => {
  try {
    const { id: marketplace } = req.params;

    const {
      enabled,
      environment,
      default_min_price,
      default_undercut_amount,
      api_configured,
      notes,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE marketplace_settings
      SET
        enabled = COALESCE($1, enabled),
        environment = COALESCE($2, environment),
        default_min_price = COALESCE($3, default_min_price),
        default_undercut_amount = COALESCE($4, default_undercut_amount),
        api_configured = api_configured,
        notes = COALESCE($5, notes),
        updated_at = NOW()
      WHERE marketplace = $6
      RETURNING *
      `,
      [
        enabled,
        environment,
        default_min_price !== undefined && default_min_price !== ""
          ? Number(default_min_price)
          : null,
        default_undercut_amount !== undefined && default_undercut_amount !== ""
          ? Number(default_undercut_amount)
          : null,
        notes ?? null,
        marketplace,
      ],
    );

    await createAuditLog({
      client_id: null,
      action: "UPDATE_MARKETPLACE_SETTINGS",
      resource_type: "marketplace_settings",
      resource_id: marketplace,
      metadata: {
        updated_fields: req.body,
        marketplace,
      },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Errore aggiornamento marketplace settings:", error);

    res.status(500).json({
      error: error.message || "Errore aggiornamento marketplace settings",
    });
  }
});

/**
 * RETRY SYNC
 */
router.post("/listings/:id/retry", async (req, res) => {
  try {
    const { id: marketplace } = req.params;

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
      [id],
    );

    res.json({
      success: true,
      listing: result.rows[0],
    });
  } catch (error) {
    console.error("Errore retry marketplace listing:", error);
    res.status(500).json({ error: "Errore retry marketplace listing" });
  }
});

/**
 * PUBLISH MARKETPLACE LISTING
 */
router.get("/publish-readiness/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticketResult = await pool.query(
      `
      SELECT
        t.*,
        e.name AS event_name,
        e.city,
        e.venue
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [ticketId],
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({
        error: "Ticket non trovato",
      });
    }

    const ticket = ticketResult.rows[0];

    const settingsResult = await pool.query(`
      SELECT *
      FROM marketplace_settings
      ORDER BY marketplace ASC
    `);

    const existingListingsResult = await pool.query(
      `
      SELECT *
      FROM marketplace_listings
      WHERE ticket_id = $1
        AND sync_status = 'synced'
      `,
      [ticketId],
    );

    const existingListingsByMarketplace = new Map(
      existingListingsResult.rows.map((listing) => [
        listing.marketplace,
        listing,
      ]),
    );

    const checks = {};

    for (const setting of settingsResult.rows) {
      const marketplace = setting.marketplace;
      const errors = [];
      const warnings = [];

      if (!setting.enabled) {
        errors.push("Marketplace disabilitato");
      }

      if (!setting.api_configured) {
        errors.push("API marketplace non configurate");
      }

      if (existingListingsByMarketplace.has(marketplace)) {
        errors.push("Ticket già pubblicato su questo marketplace");
      }

      if (Number(ticket.available_quantity || 0) <= 0) {
        errors.push("Quantità non disponibile");
      }

      if (
        !Number(
          ticket.marketplace_price || ticket.partner_price || ticket.price || 0,
        )
      ) {
        errors.push("Prezzo marketplace mancante");
      }

      if (!ticket.category) {
        errors.push("Categoria interna mancante");
      }

      if (marketplace === "ticombo" || marketplace === "sportevents365") {
        const eventMappingResult = await pool.query(
          `
          SELECT *
          FROM marketplace_mappings
          WHERE marketplace = $1
            AND mapping_type = 'event'
            AND internal_event_id = $2
            AND is_active = true
          LIMIT 1
          `,
          [marketplace, ticket.event_id],
        );

        if (eventMappingResult.rows.length === 0) {
          errors.push("Mapping evento mancante");
        }

        const categoryMappingResult = await pool.query(
          `
          SELECT *
          FROM marketplace_mappings
          WHERE marketplace = $1
            AND mapping_type = 'category'
            AND internal_event_id = $2
            AND internal_category = $3
            AND is_active = true
          LIMIT 1
          `,
          [marketplace, ticket.event_id, ticket.category],
        );

        if (categoryMappingResult.rows.length === 0) {
          errors.push("Mapping categoria mancante");
        }
      }

      if (marketplace === "gigsberg") {
        warnings.push(
          "Gigsberg usa matching automatico evento/categoria tramite API",
        );
      }

      checks[marketplace] = {
        ready: errors.length === 0,
        errors,
        warnings,
      };
    }

    return res.json({
      ticket_id: Number(ticketId),
      ticket: {
        id: ticket.id,
        event_id: ticket.event_id,
        event_name: ticket.event_name,
        city: ticket.city,
        venue: ticket.venue,
        category: ticket.category,
        block: ticket.block,
        available_quantity: ticket.available_quantity,
        marketplace_price:
          ticket.marketplace_price || ticket.partner_price || ticket.price,
      },
      checks,
    });
  } catch (error) {
    console.error("Errore publish readiness:", error);

    return res.status(500).json({
      error: error.message || "Errore publish readiness",
    });
  }
});
router.post("/publish", async (req, res) => {
  try {
    const { ticket_id, marketplace } = req.body;

    if (!ticket_id || !marketplace) {
      return res.status(400).json({
        error: "ticket_id e marketplace sono obbligatori",
      });
    }

    const normalizedMarketplace = String(marketplace).toLowerCase();
    const marketplaceSettingResult = await pool.query(
      `
      SELECT *
      FROM marketplace_settings
      WHERE marketplace = $1
      LIMIT 1
      `,
      [normalizedMarketplace],
    );

    if (marketplaceSettingResult.rows.length === 0) {
      return res.status(400).json({
        error: `Marketplace non configurato: ${normalizedMarketplace}`,
      });
    }

    const marketplaceSetting = marketplaceSettingResult.rows[0];

    if (!marketplaceSetting.enabled) {
      return res.status(400).json({
        error: `Marketplace disabilitato: ${normalizedMarketplace}`,
      });
    }

    if (!marketplaceSetting.api_configured) {
      return res.status(400).json({
        error: `API marketplace non configurate: ${normalizedMarketplace}`,
      });
    }

    /**
     * GIGSBERG
     */
    if (normalizedMarketplace === "gigsberg") {
      try {
        const existingGigsbergResult = await pool.query(
          `
          SELECT *
          FROM marketplace_listings
          WHERE ticket_id = $1
            AND marketplace = 'gigsberg'
            AND sync_status = 'synced'
            AND remote_listing_id IS NOT NULL
          ORDER BY id DESC
          LIMIT 1
          `,
          [ticket_id],
        );

        if (existingGigsbergResult.rows.length > 0) {
          return res.status(400).json({
            error: "Ticket già pubblicato su Gigsberg",
            listing: existingGigsbergResult.rows[0],
          });
        }

        const gigsbergResult = await createGigsbergListing(ticket_id);

        const remoteListingId =
          gigsbergResult?.response?.content?.id ||
          gigsbergResult?.response?.id ||
          null;

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
            external_listing_id,
            sync_status,
            sync_direction,
            last_sync_at,
            marketplace_price,
            last_quantity_synced,
            last_quantity_sync_at,
            last_error
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,NOW(),$10,$11,NOW(),$12)
          RETURNING *
          `,
          [
            ticket_id,
            "gigsberg",
            gigsbergResult.gigsberg_event_id,
            gigsbergResult.gigsberg_category_id,
            gigsbergResult.gigsberg_event_id,
            gigsbergResult.gigsberg_category_id,
            remoteListingId,
            "synced",
            "inventory_to_marketplace",
            gigsbergResult.price_check?.finalPrice || null,
            null,
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
            ticket_id,
            "gigsberg",
            "publish",
            "synced",
            JSON.stringify(gigsbergResult),
            null,
          ],
        );

        return res.json({
          success: true,
          message: "Ticket pubblicato su Gigsberg",
          listing: listingResult.rows[0],
          result: gigsbergResult,
        });
      } catch (error) {
        const details = error.response?.data || error.message;

        console.error(
          "Errore publish reale Gigsberg:",
          JSON.stringify(details, null, 2),
        );

        return res.status(500).json({
          error: "Errore publish Gigsberg",
          details,
        });
      }
    }

    /**
     * TICOMBO REAL PUBLISH
     */
    if (normalizedMarketplace === "ticombo") {
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
        return res.status(404).json({ error: "Ticket non trovato" });
      }

      const ticket = ticketResult.rows[0];

      const existingSyncedResult = await pool.query(
        `
        SELECT *
        FROM marketplace_listings
        WHERE ticket_id = $1
          AND marketplace = 'ticombo'
          AND sync_status = 'synced'
          AND remote_listing_id IS NOT NULL
        ORDER BY id DESC
        `,
        [ticket_id],
      );

      if (existingSyncedResult.rows.length > 0) {
        const activeListing = existingSyncedResult.rows[0];

        if (existingSyncedResult.rows.length > 1) {
          const duplicateIds = existingSyncedResult.rows
            .slice(1)
            .map((listing) => listing.id);

          await pool.query(
            `
            UPDATE marketplace_listings
            SET
              sync_status = 'superseded',
              updated_at = NOW(),
              last_error = NULL
            WHERE id = ANY($1::int[])
            `,
            [duplicateIds],
          );
        }

        return res.status(400).json({
          error: "Ticket già pubblicato su Ticombo",
          listing: activeListing,
        });
      }

      const pendingListingResult = await pool.query(
        `
        SELECT *
        FROM marketplace_listings
        WHERE ticket_id = $1
          AND marketplace = 'ticombo'
          AND sync_status IN ('pending', 'failed', 'needs_sync')
        ORDER BY id DESC
        LIMIT 1
        `,
        [ticket_id],
      );

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

      const eventMapping = eventMappingResult.rows[0];
      const categoryMapping = categoryMappingResult.rows[0];

      const quantity = Number(ticket.available_quantity || 0);

      if (quantity <= 0) {
        return res.status(400).json({
          error: `Impossibile pubblicare su Ticombo: quantità non disponibile per ticket ${ticket.id}`,
        });
      }

      const price = Number(
        ticket.marketplace_price || ticket.partner_price || ticket.price || 0,
      );

      const ticomboPayload = {
        eventId: eventMapping.remote_event_id,
        type: "e-tickets",
        category: categoryMapping.remote_category_name,
        quantity,
        isInPossession: false,
        listWithoutTicketUpload: false,
        seatAllocationType: "general",
        bookingConfirmationFiles: [
          "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        ],
        delivery: {
          inHandDate: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        price,
        currency: "EUR",
        faceValue: Number(ticket.price || price || 0),
        allowProposals: false,
        refId: `inventory-${ticket.id}`,
        sellingOptions: {
          splitType: "none",
          maxDisplayQuantity: quantity,
        },
      };

      console.log("TICOMBO PAYLOAD:", JSON.stringify(ticomboPayload, null, 2));

      let publishResponse;

      try {
        publishResponse = await createTicomboListing(ticomboPayload);
      } catch (publishError) {
        console.error(
          "Errore publish Ticombo:",
          publishError.response?.data || publishError.message,
        );

        const failedListing =
          pendingListingResult.rows[0] ||
          (
            await pool.query(
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
                "failed",
                "inventory_to_marketplace",
                price,
                publishError.response?.data
                  ? JSON.stringify(publishError.response.data)
                  : publishError.message,
              ],
            )
          ).rows[0];

        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            sync_status = 'failed',
            last_error = $1,
            last_sync_at = NOW(),
            updated_at = NOW()
          WHERE id = $2
          `,
          [
            publishError.response?.data
              ? JSON.stringify(publishError.response.data)
              : publishError.message,
            failedListing.id,
          ],
        );

        return res.status(500).json({
          error: "Publish Ticombo fallito",
          details: publishError.response?.data || publishError.message,
        });
      }

      const remoteListingId = publishResponse?.data?.listingId || null;

      let listingResult;

      if (pendingListingResult.rows.length > 0) {
        listingResult = await pool.query(
          `
          UPDATE marketplace_listings
          SET
            external_event_id = $1,
            external_category_id = $2,
            remote_event_id = $3,
            remote_category_id = $4,
            remote_listing_id = $5,
            sync_status = 'synced',
            sync_direction = 'inventory_to_marketplace',
            last_sync_at = NOW(),
            marketplace_price = $6,
            last_error = NULL,
            updated_at = NOW()
          WHERE marketplace = $7
          RETURNING *
          `,
          [
            eventMapping.remote_event_id,
            categoryMapping.remote_category_id,
            eventMapping.remote_event_id,
            categoryMapping.remote_category_id,
            remoteListingId,
            price,
            pendingListingResult.rows[0].id,
          ],
        );
      } else {
        listingResult = await pool.query(
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
            "ticombo",
            eventMapping.remote_event_id,
            categoryMapping.remote_category_id,
            eventMapping.remote_event_id,
            categoryMapping.remote_category_id,
            remoteListingId,
            "synced",
            "inventory_to_marketplace",
            price,
            null,
          ],
        );
      }

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
          "publish",
          "synced",
          publishResponse,
          null,
        ],
      );

      return res.json({
        success: true,
        message: "Ticket pubblicato su Ticombo",
        listing: listingResult.rows[0],
        response: publishResponse,
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
        [ticket_id],
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ error: "Ticket non trovato" });
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
        [ticket_id],
      );

      if (existingListingResult.rows.length > 0) {
        return res.status(400).json({
          error: "Ticket già pubblicato su SportEvents365",
          listing: existingListingResult.rows[0],
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
        [ticket.event_id],
      );

      if (eventMappingResult.rows.length === 0) {
        return res.status(400).json({
          error: "Mapping evento SportEvents365 mancante",
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
        [ticket.event_id, ticket.category],
      );

      if (categoryMappingResult.rows.length === 0) {
        return res.status(400).json({
          error: `Mapping categoria SportEvents365 mancante per ${ticket.category}`,
        });
      }

      const categoryMapping = categoryMappingResult.rows[0];

      const sportEventsPayload = [
        {
          categoryId: Number(categoryMapping.remote_category_id),
          quantity: Number(ticket.available_quantity || 0),
          price: Number(
            ticket.marketplace_price ||
              ticket.partner_price ||
              ticket.price ||
              0,
          ),
          currency: "EUR",
          shippingMethodId: 1006,
          sittingArrangementId: 5,
          sellingLimitations: [],
          restrictions: [],
          notes: ticket.block || "",
        },
      ];

      let publishResponse;

      try {
        publishResponse = await createSupplierTickets(
          eventMapping.remote_event_id,
          sportEventsPayload,
        );
      } catch (publishError) {
        return res.status(500).json({
          error: "Publish SportEvents365 fallito",
          details: publishError.response?.data || publishError.message,
        });
      }

      const remoteListingId = publishResponse?.data?.tickets?.[0] || null;

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
              0,
          ),
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
          "sportevents365",
          "publish",
          "synced",
          publishResponse,
          null,
        ],
      );

      return res.json({
        success: true,
        message: "Ticket pubblicato su SportEvents365",
        listing: listingResult.rows[0],
        response: publishResponse,
      });
    }

    return res.status(400).json({
      error: `Marketplace non supportato: ${marketplace}`,
    });
  } catch (error) {
    console.error("Errore publish marketplace:", error);

    return res.status(500).json({
      error: error.message || "Errore publish marketplace",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE / UNPUBLISH MARKETPLACE LISTING
|--------------------------------------------------------------------------
*/
router.post("/listings/:id/run-repricing", async (req, res) => {
  try {
    const { id } = req.params;

    const listingResult = await pool.query(
      `
      SELECT
        ml.*,
        t.id AS ticket_id,
        t.marketplace_price AS ticket_marketplace_price
      FROM marketplace_listings ml
      JOIN tickets t ON t.id = ml.ticket_id
      WHERE ml.id = $1
      LIMIT 1
      `,
      [id],
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Marketplace listing non trovato",
      });
    }

    const listing = listingResult.rows[0];

    const priceCheck = calculateSafePrice({
      currentPrice: Number(
        listing.marketplace_price || listing.ticket_marketplace_price || 0,
      ),
      marketLowestPrice: Number(listing.last_market_price || 0),
      minPrice: Number(listing.min_price || 0),
      undercutAmount: Number(listing.undercut_amount || 0.01),
    });

    if (!priceCheck.shouldUpdate) {
      await pool.query(
        `
        UPDATE marketplace_listings
        SET
          last_suggested_price = $1,
          last_reprice_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
        `,
        [priceCheck.suggestedPrice, id],
      );

      return res.json({
        success: true,
        updated: false,
        reason: priceCheck.reason,
        result: priceCheck,
      });
    }

    await pool.query(
      `
      UPDATE marketplace_listings
      SET
        marketplace_price = $1,
        last_suggested_price = $2,
        last_reprice_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      `,
      [priceCheck.finalPrice, priceCheck.suggestedPrice, id],
    );

    await pool.query(
      `
      UPDATE tickets
      SET
        marketplace_price = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [priceCheck.finalPrice, listing.ticket_id],
    );

    return res.json({
      success: true,
      updated: true,
      old_price: listing.marketplace_price,
      new_price: priceCheck.finalPrice,
      result: priceCheck,
    });
  } catch (error) {
    console.error("Errore run repricing listing:", error);

    return res.status(500).json({
      error: error.message || "Errore run repricing listing",
    });
  }
});

router.delete("/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const listingResult = await pool.query(
      `
      SELECT *
      FROM marketplace_listings
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Marketplace listing non trovato",
      });
    }

    const listing = listingResult.rows[0];

    /*
    |--------------------------------------------------------------------------
    | GIGSBERG
    |--------------------------------------------------------------------------
    */

    if (listing.marketplace === "gigsberg") {
      if (!listing.remote_listing_id) {
        return res.status(400).json({
          error: "remote_listing_id mancante",
        });
      }

      const deleteResponse = await deleteGigsbergListing(
        listing.remote_listing_id,
      );

      await pool.query(
        `
        UPDATE marketplace_listings
        SET
          sync_status = 'deleted',
          last_sync_at = NOW(),
          updated_at = NOW(),
          last_error = NULL
        WHERE id = $1
        `,
        [listing.id],
      );

      await pool.query(
        `
        INSERT INTO marketplace_sync_logs (
          marketplace_listing_id,
          ticket_id,
          marketplace,
          action,
          status,
          response_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          listing.id,
          listing.ticket_id,
          listing.marketplace,
          "delete_listing",
          "success",
          JSON.stringify(deleteResponse),
        ],
      );

      return res.json({
        success: true,
        message: "Listing Gigsberg eliminato",
        response: deleteResponse,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | TICOMBO
    |--------------------------------------------------------------------------
    */

    if (listing.marketplace === "ticombo") {
      if (!listing.remote_listing_id) {
        return res.status(400).json({
          error: "remote_listing_id mancante",
        });
      }

      const deleteResponse = await deleteTicomboListing(
        listing.remote_listing_id,
      );

      await pool.query(
        `
        UPDATE marketplace_listings
        SET
          sync_status = 'deleted',
          last_sync_at = NOW(),
          updated_at = NOW(),
          last_error = NULL
        WHERE id = $1
        `,
        [listing.id],
      );

      await pool.query(
        `
        INSERT INTO marketplace_sync_logs (
          marketplace_listing_id,
          ticket_id,
          marketplace,
          action,
          status,
          response_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          listing.id,
          listing.ticket_id,
          listing.marketplace,
          "delete_listing",
          "success",
          JSON.stringify(deleteResponse),
        ],
      );

      return res.json({
        success: true,
        message: "Listing Ticombo eliminato",
        response: deleteResponse,
      });
    }

    return res.status(400).json({
      error: `Delete non supportato per marketplace ${listing.marketplace}`,
    });
  } catch (error) {
    console.error("Errore delete marketplace listing:", error);

    return res.status(500).json({
      error:
        error.response?.data ||
        error.message ||
        "Errore delete marketplace listing",
    });
  }
});

module.exports = router;
