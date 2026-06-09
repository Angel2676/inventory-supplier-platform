const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const pool = require("../db");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

const {
  createGigsbergListing,
} = require("../services/integrations/gigsberg/gigsbergListings");

const {
  deleteListing: deleteGigsbergListing,
  updateListing: updateGigsbergListing,
  searchEvents: searchGigsbergEvents,
} = require("../services/integrations/gigsberg/gigsbergApi");

const {
  findGigsbergPublicEventUrl,
} = require("../services/integrations/gigsberg/gigsbergPublicBrowserMarket");

const {
  searchSportEvents365Events,
  createSupplierTickets,
} = require("../services/integrations/sportevents365/sportevents365Api");

const {
  searchTicomboEvents,
  getTicomboEventById,
} = require("../services/ticomboService");

const {
  createTicomboListing,
  deleteTicomboListing,
} = require("../services/integrations/ticombo/ticomboListings");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

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
        t.last_market_price,
        t.suggested_marketplace_price,
        
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
router.get("/ticombo/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const data = await getTicomboEventById(eventId);

    return res.json({
      success: true,
      eventId,
      data,
    });
  } catch (error) {
    console.error("Ticombo event detail error:", error.response?.data || error);

    return res.status(500).json({
      error:
        error.response?.data?.message ||
        error.message ||
        "Ticombo event detail failed",
      details: error.response?.data || null,
    });
  }
});

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
      const gigsbergResults = await searchGigsbergEvents({
        keyword,
        future_events_only: true,
        per_page: 50,
      });

      results = Array.isArray(gigsbergResults?.items)
        ? gigsbergResults.items
        : Array.isArray(gigsbergResults?.data)
          ? gigsbergResults.data
          : Array.isArray(gigsbergResults)
            ? gigsbergResults
            : [];
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

router.get("/ticombo/events/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        error: "Missing search query",
      });
    }

    const data = await searchTicomboEvents(q);

    return res.json({
      success: true,
      query: q,
      data,
    });
  } catch (error) {
    console.error("Ticombo event search error:", error.response?.data || error);

    return res.status(500).json({
      error:
        error.response?.data?.message ||
        error.message ||
        "Ticombo event search failed",
      details: error.response?.data || null,
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
router.post(
  "/mappings/import-public-urls",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "File CSV mancante",
        });
      }

      const rows = [];

      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
          rows.push(row);
        })
        .on("end", async () => {
          let updated = 0;
          let skipped = 0;
          let failed = 0;
          const details = [];

          for (const row of rows) {
            const remoteEventId = row.remote_event_id;
            const publicUrl = row.public_url;

            if (!remoteEventId || !publicUrl) {
              skipped += 1;
              details.push({
                status: "skipped",
                reason: "missing_remote_event_id_or_public_url",
                row,
              });
              continue;
            }

            if (!publicUrl.startsWith("https://www.gigsberg.com/")) {
              skipped += 1;
              details.push({
                status: "skipped",
                reason: "invalid_gigsberg_url",
                remote_event_id: remoteEventId,
                public_url: publicUrl,
              });
              continue;
            }

            try {
              const result = await pool.query(
                `
              UPDATE marketplace_mappings
              SET public_url = $1,
                  updated_at = NOW()
              WHERE marketplace = 'gigsberg'
                AND mapping_type = 'event'
                AND remote_event_id = $2
              RETURNING id, internal_event_id, remote_event_id, remote_event_name, public_url
              `,
                [publicUrl, remoteEventId],
              );

              if (result.rowCount === 0) {
                skipped += 1;
                details.push({
                  status: "skipped",
                  reason: "mapping_not_found",
                  remote_event_id: remoteEventId,
                  public_url: publicUrl,
                });
              } else {
                updated += result.rowCount;
                details.push({
                  status: "updated",
                  rows: result.rows,
                });
              }
            } catch (error) {
              failed += 1;
              details.push({
                status: "failed",
                remote_event_id: remoteEventId,
                public_url: publicUrl,
                error: error.message,
              });
            }
          }

          fs.unlink(req.file.path, () => {});

          return res.json({
            updated,
            skipped,
            failed,
            details,
          });
        })
        .on("error", (error) => {
          fs.unlink(req.file.path, () => {});

          return res.status(500).json({
            error: "Errore lettura CSV",
            details: error.message,
          });
        });
    } catch (error) {
      console.error("Errore import public URL Gigsberg:", error);

      return res.status(500).json({
        error: "Errore import public URL Gigsberg",
        details: error.message,
      });
    }
  },
);
router.get("/mappings/export-public-urls", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        remote_event_id,
        COALESCE(remote_event_name, '') AS remote_event_name,
        COALESCE(public_url, '') AS public_url
      FROM marketplace_mappings
      WHERE marketplace = 'gigsberg'
        AND mapping_type = 'event'
        AND is_active = true
        AND remote_event_id IS NOT NULL
      ORDER BY remote_event_name, remote_event_id
    `);

    const escapeCsv = (value) => {
      const text = String(value ?? "");
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csvRows = [
      ["remote_event_id", "remote_event_name", "public_url"],
      ...result.rows.map((row) => [
        row.remote_event_id,
        row.remote_event_name,
        row.public_url,
      ]),
    ];

    const csvContent = csvRows
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="gigsberg_public_urls.csv"',
    );

    return res.send(csvContent);
  } catch (error) {
    console.error("Errore export public URL Gigsberg:", error);

    return res.status(500).json({
      error: "Errore export public URL Gigsberg",
      details: error.message,
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
      public_url,
      notes,
      is_active,
    } = req.body;

    if (!marketplace || !mapping_type || !internal_event_id) {
      return res.status(400).json({
        error: "marketplace, mapping_type e internal_event_id sono obbligatori",
      });
    }

    let existingResult;

    if (mapping_type === "event") {
      existingResult = await pool.query(
        `
        SELECT *
        FROM marketplace_mappings
        WHERE marketplace = $1
          AND mapping_type = 'event'
          AND internal_event_id = $2
          AND is_active = true
        LIMIT 1
        `,
        [marketplace, internal_event_id],
      );
    } else if (mapping_type === "category") {
      existingResult = await pool.query(
        `
        SELECT *
        FROM marketplace_mappings
        WHERE marketplace = $1
          AND mapping_type = 'category'
          AND internal_event_id = $2
          AND internal_category = $3
          AND COALESCE(internal_block, '') = COALESCE($4, '')
          AND is_active = true
        LIMIT 1
        `,
        [
          marketplace,
          internal_event_id,
          internal_category || null,
          internal_block || null,
        ],
      );
    } else {
      existingResult = { rows: [] };
    }

    let result;

    if (existingResult.rows.length > 0) {
      result = await pool.query(
        `
        UPDATE marketplace_mappings
        SET
          internal_category = $1,
          internal_block = $2,
          remote_event_id = $3,
          remote_event_name = $4,
          remote_category_id = $5,
          remote_category_name = $6,
          remote_block_id = $7,
          remote_block_name = $8,
          public_url = $9,
          notes = $10,
          is_active = $11,
          updated_at = NOW()
        WHERE id = $12
        RETURNING *
        `,
        [
          internal_category || null,
          internal_block || null,
          remote_event_id || null,
          remote_event_name || null,
          remote_category_id || null,
          remote_category_name || null,
          remote_block_id || null,
          remote_block_name || null,
          public_url || null,
          notes || null,
          is_active !== false,
          existingResult.rows[0].id,
        ],
      );
    } else {
      result = await pool.query(
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
          public_url,
          notes,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
          public_url || null,
          notes || null,
          is_active !== false,
        ],
      );
    }

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
    console.error("Errore creazione/aggiornamento marketplace mapping:", error);
    res.status(500).json({
      error:
        error.message || "Errore creazione/aggiornamento marketplace mapping",
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
      public_url,
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
        public_url = $12,
        notes = $13,
        is_active = $14,
        updated_at = NOW()
      WHERE id = $15
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
        public_url || null,
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
      SELECT
        mo.*,

        COALESCE(
          t.category,
          mo.raw_payload->>'category'
        ) AS category,

        COALESCE(
          t.block,
          mo.raw_payload->>'block'
        ) AS block,

        COALESCE(
          e.event_date,
          NULLIF(mo.raw_payload->>'event_date', '')::timestamp
        ) AS event_date,

        COALESCE(
          mo.raw_payload->>'notes',
          ''
        ) AS notes

      FROM marketplace_orders mo

      LEFT JOIN tickets t
        ON t.id = mo.ticket_id

      LEFT JOIN events e
        ON e.id = t.event_id

      ORDER BY mo.created_at DESC
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

      let categoryMapping = null;

      let blockMapping = null;

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

        const eventMapping = eventMappingResult.rows[0];

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
          console.log("TICOMBO CONTENT REQUEST TRIGGERED");
          const errorText = `Mapping categoria Ticombo mancante per ${ticket.category}`;

          await pool.query(
            `
    INSERT INTO marketplace_content_requests (
      marketplace,
      event_id,
      event_name,
      event_date,
      venue,
      city,
      country,
      request_status,
      remote_event_id,
      notes,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    `,
            [
              "ticombo",
              ticket.event_id,
              ticket.event_name,
              ticket.event_date,
              ticket.venue,
              ticket.city,
              ticket.country,
              "pending",
              eventMapping?.remote_event_id || null,
              errorText,
            ],
          );

          warnings.push("Marketplace content request created");

          checks[marketplace] = {
            ready: false,
            errors,
            warnings,
          };

          continue;
        }

        categoryMapping = categoryMappingResult.rows[0];

        blockMapping = null;

        if (ticket.block) {
          const blockMappingResult = await pool.query(
            `
            SELECT *
            FROM marketplace_mappings
            WHERE marketplace = $1
              AND mapping_type = 'block'
              AND internal_event_id = $2
              AND internal_category = $3
              AND internal_block = $4
              AND is_active = true
            LIMIT 1
            `,
            [marketplace, ticket.event_id, ticket.category, ticket.block],
          );

          blockMapping = blockMappingResult.rows[0] || null;

          if (!blockMapping) {
            warnings.push(
              `Block mapping opzionale mancante per ${ticket.category} / ${ticket.block}`,
            );
          }
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

        const ticketResult = await pool.query(
          `
          SELECT
            auto_reprice_enabled,
            min_price,
            last_market_price,
            undercut_amount
          FROM tickets
          WHERE id = $1
          `,
          [ticket_id],
        );

        const ticket = ticketResult.rows[0] || {};
        const gigsbergResult = await createGigsbergListing(ticket_id);

        const remoteListingId =
          gigsbergResult?.response?.content?.id ||
          gigsbergResult?.response?.id ||
          null;
        let publicUrl =
          gigsbergResult?.response?.content?.public_url ||
          gigsbergResult?.response?.content?.publicUrl ||
          gigsbergResult?.response?.content?.url ||
          gigsbergResult?.response?.public_url ||
          gigsbergResult?.response?.publicUrl ||
          gigsbergResult?.response?.url ||
          gigsbergResult?.public_url ||
          gigsbergResult?.publicUrl ||
          gigsbergResult?.url ||
          null;

        if (!publicUrl) {
          publicUrl = await findGigsbergPublicEventUrl({
            eventName: gigsbergResult?.gigsberg_event?.name,
            remoteEventId: gigsbergResult?.gigsberg_event_id,
          });
        }

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
            public_url,
            sync_status,
            sync_direction,
            last_sync_at,
            marketplace_price,
            last_quantity_synced,
            last_quantity_sync_at,
            last_error,
            auto_reprice_enabled,
            min_price,
            last_market_price,
            undercut_amount
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,
            NOW(),
            $11,$12,NOW(),$13,
            $14,$15,$16,$17
          )
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
            publicUrl,
            "synced",
            "inventory_to_marketplace",
            gigsbergResult.price_check?.finalPrice || null,
            null,
            null,

            ticket.auto_reprice_enabled || false,

            ticket.min_price || null,

            ticket.last_market_price || null,

            ticket.undercut_amount || 0.01,
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
        console.log("TICOMBO CONTENT REQUEST TRIGGERED");

        const errorText = `Mapping categoria Ticombo mancante per ${ticket.category}`;

        try {
          await pool.query(
            `
      INSERT INTO marketplace_content_requests (
        marketplace,
        event_id,
        event_name,
        event_date,
        venue,
        city,
        country,
        request_status,
        remote_event_id,
        notes,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      `,
            [
              "ticombo",
              ticket.event_id,
              ticket.event_name,
              ticket.event_date,
              ticket.venue,
              ticket.city,
              ticket.country,
              "pending",
              eventMappingResult.rows[0]?.remote_event_id || null,
              errorText,
            ],
          );

          console.log("TICOMBO CONTENT REQUEST INSERTED");
        } catch (insertError) {
          console.error("TICOMBO CONTENT REQUEST INSERT FAILED:", insertError);
        }

        return res.status(202).json({
          success: false,
          status: "pending_content_request",
          message: errorText,
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
        concession: {
          fanSection: "No Fan Restrictions",
        },
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
        const ticomboError = publishError.response?.data || {};

        const ticomboErrorText = JSON.stringify(ticomboError).toLowerCase();

        const isMarketplaceContentIssue =
          ticomboErrorText.includes("event not found") ||
          ticomboErrorText.includes('"eventid"') ||
          ticomboErrorText.includes("category not found") ||
          ticomboErrorText.includes("mapping") ||
          ticomboErrorText.includes("invalid event") ||
          ticomboErrorText.includes("supplier not enabled") ||
          ticomboErrorText.includes("publication unavailable");

        if (isMarketplaceContentIssue) {
          const errorText = JSON.stringify(ticomboError);

          const listingResult = pendingListingResult.rows[0]
            ? { rows: [pendingListingResult.rows[0]] }
            : await pool.query(
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
                  "pending_content_request",
                  "inventory_to_marketplace",
                  price,
                  errorText,
                ],
              );

          const waitingListing = listingResult.rows[0];

          await pool.query(
            `
    UPDATE marketplace_listings
    SET
      sync_status = 'pending_content_request',
      last_error = $1,
      last_sync_at = NOW(),
      updated_at = NOW(),
      next_retry_at = NULL,
      circuit_breaker_until = NULL
    WHERE id = $2
    `,
            [errorText, waitingListing.id],
          );

          try {
            await pool.query(
              `
    INSERT INTO marketplace_content_requests (
      marketplace,
      event_id,
      event_name,
      event_date,
      venue,
      city,
      country,
      request_status,
      remote_event_id,
      notes,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
    `,
              [
                "ticombo",
                ticket.event_id,
                ticket.event_name,
                ticket.event_date,
                ticket.venue,
                ticket.city,
                ticket.country,
                "pending",
                eventMappingResult.rows[0]?.remote_event_id || null,
                errorText,
              ],
            );

            console.log("TICOMBO CONTENT REQUEST INSERTED");
          } catch (insertError) {
            console.error(
              "TICOMBO CONTENT REQUEST INSERT FAILED:",
              insertError,
            );
          }

          return res.status(202).json({
            success: false,
            status: "pending_content_request",
            message:
              "Evento Ticombo non disponibile nel catalogo Seller API. Creata richiesta per content team.",
            details: ticomboError,
          });
        }

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

      const remoteListingId =
        publishResponse?.data?.listingId ||
        publishResponse?.data?.id ||
        publishResponse?.listingId ||
        publishResponse?.id ||
        publishResponse?.data?.listing?.id ||
        null;

      console.log("TICOMBO PUBLISH RESPONSE:", {
        remoteListingId,
        publishResponse,
      });

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
      const deleteResponse = await updateGigsbergListing(
        listing.remote_listing_id,
        {
          quantity: 0,
          presented_quantity: 0,
        },
      );

      console.log("[GIGSBERG DELIST RESPONSE]", {
        listingId: listing.id,
        remote_listing_id: listing.remote_listing_id,
        deleteResponse,
      });

      if (
        !deleteResponse ||
        deleteResponse.error ||
        deleteResponse.success === false
      ) {
        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            last_sync_at = NOW(),
            updated_at = NOW(),
            last_error = $2
          WHERE id = $1
          `,
          [
            listing.id,
            JSON.stringify(
              deleteResponse || {
                error: "Empty response from Gigsberg delete",
              },
            ),
          ],
        );

        return res.status(502).json({
          error: "Delist Gigsberg non confermato",
          details: deleteResponse || null,
        });
      }

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

router.post("/gigsberg/publish-all", async (req, res) => {
  const { eventId, dryRun = true, limit = 25 } = req.body;

  if (!eventId) {
    return res.status(400).json({
      error: "eventId obbligatorio per Publish All Gigsberg",
    });
  }

  try {
    const ticketsResult = await pool.query(
      `
        SELECT
          t.id,
          t.category,
          t.block,
          t.quantity,
          t.available_quantity,
          t.status,
          t.price,
          e.name AS event_name
        FROM tickets t
        JOIN events e ON e.id = t.event_id
        WHERE t.event_id = $1
          AND COALESCE(t.quantity, 0) > 0
          AND COALESCE(t.status, 'available') = 'available'
          AND NOT EXISTS (
            SELECT 1
            FROM marketplace_listings ml
            WHERE ml.ticket_id = t.id
              AND ml.marketplace = 'gigsberg'
              AND ml.sync_status = 'synced'
              AND ml.remote_listing_id IS NOT NULL
          )
        ORDER BY t.id ASC
        LIMIT $2
        `,
      [eventId, Number(limit) || 25],
    );

    const tickets = ticketsResult.rows;

    const report = {
      marketplace: "gigsberg",
      eventId,
      dryRun: Boolean(dryRun),
      totalCandidates: tickets.length,
      successCount: 0,
      skippedCount: 0,
      errorCount: 0,
      results: [],
    };

    for (const ticket of tickets) {
      if (dryRun) {
        report.skippedCount += 1;
        report.results.push({
          ticketId: ticket.id,
          eventName: ticket.event_name,
          category: ticket.category,
          block: ticket.block,
          quantity: ticket.quantity,
          availableQuantity: ticket.available_quantity,
          status: ticket.status,
          price: ticket.price,
          success: false,
          skipped: true,
          reason: "dry_run",
          message: "Ticket pronto per verifica Publish All Gigsberg",
        });

        continue;
      }

      try {
        const existingResult = await pool.query(
          `
            SELECT id
            FROM marketplace_listings
            WHERE ticket_id = $1
              AND marketplace = 'gigsberg'
              AND sync_status = 'synced'
              AND remote_listing_id IS NOT NULL
            LIMIT 1
            `,
          [ticket.id],
        );

        if (existingResult.rows.length > 0) {
          report.skippedCount += 1;
          report.results.push({
            ticketId: ticket.id,
            success: false,
            skipped: true,
            reason: "already_published",
            message: "Ticket già pubblicato su Gigsberg",
          });

          continue;
        }

        const gigsbergResult = await createGigsbergListing(ticket.id);

        const remoteListingId =
          gigsbergResult?.response?.content?.id ||
          gigsbergResult?.response?.id ||
          null;
        let publicUrl =
          gigsbergResult?.response?.content?.public_url ||
          gigsbergResult?.response?.content?.publicUrl ||
          gigsbergResult?.response?.content?.url ||
          gigsbergResult?.response?.public_url ||
          gigsbergResult?.response?.publicUrl ||
          gigsbergResult?.response?.url ||
          gigsbergResult?.public_url ||
          gigsbergResult?.publicUrl ||
          gigsbergResult?.url ||
          null;

        if (!publicUrl) {
          publicUrl = await findGigsbergPublicEventUrl({
            eventName: gigsbergResult?.gigsberg_event?.name,
            remoteEventId: gigsbergResult?.gigsberg_event_id,
          });
        }

        const ticketSettingsResult = await pool.query(
          `
            SELECT
              auto_reprice_enabled,
              min_price,
              last_market_price,
              undercut_amount
            FROM tickets
            WHERE id = $1
            `,
          [ticket.id],
        );

        const ticketSettings = ticketSettingsResult.rows[0] || {};

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
              public_url,
              sync_status,
              sync_direction,
              last_sync_at,
              marketplace_price,
              last_quantity_synced,
              last_quantity_sync_at,
              last_error,
              auto_reprice_enabled,
              min_price,
              last_market_price,
              undercut_amount
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,
              NOW(),
              $11,$12,NOW(),$13,
              $14,$15,$16,$17
            )
            RETURNING *
            `,
          [
            ticket.id,
            "gigsberg",
            gigsbergResult.gigsberg_event_id,
            gigsbergResult.gigsberg_category_id,
            gigsbergResult.gigsberg_event_id,
            gigsbergResult.gigsberg_category_id,
            remoteListingId,
            publicUrl,
            "synced",
            "inventory_to_marketplace",
            gigsbergResult.price_check?.finalPrice || null,
            null,
            null,
            ticketSettings.auto_reprice_enabled || false,
            ticketSettings.min_price || null,
            ticketSettings.last_market_price || null,
            ticketSettings.undercut_amount || 0.01,
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
            "gigsberg",
            "publish_all",
            "synced",
            JSON.stringify(gigsbergResult),
            null,
          ],
        );

        report.successCount += 1;
        report.results.push({
          ticketId: ticket.id,
          success: true,
          listing: listingResult.rows[0],
          result: gigsbergResult,
        });
      } catch (error) {
        const details = error.response?.data || error.message;

        report.errorCount += 1;
        report.results.push({
          ticketId: ticket.id,
          success: false,
          error: details,
        });

        console.error("Publish All Gigsberg ticket error:", {
          ticketId: ticket.id,
          details,
        });
      }
    }

    return res.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Errore Publish All Gigsberg:", error);

    return res.status(500).json({
      error: "Errore Publish All Gigsberg",
      details: error.message,
    });
  }
});
router.post(
  "/ticombo/catalog/upload",
  authJwt,
  requireRole("super_admin"),
  upload.single("file"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "File CSV mancante",
        });
      }

      const rows = [];

      fs.createReadStream(req.file.path)
        .pipe(csv({ separator: ";" }))
        .on("data", (row) => rows.push(row))
        .on("end", async () => {
          try {
            await client.query("BEGIN");

            let imported = 0;

            for (const row of rows) {
              const cleanRow = Object.fromEntries(
                Object.entries(row).map(([key, value]) => [
                  key.replace(/^\uFEFF/, "").trim(),
                  typeof value === "string" ? value.trim() : value,
                ]),
              );
              await client.query(
                `
                INSERT INTO ticombo_event_catalog (
                  slug,
                  remote_event_id,
                  event_name,
                  event_type,
                  event_date,
                  city,
                  venue,
                  new_category_allowed,
                  new_section_allowed,
                  category,
                  section,
                  spectator_stand,
                  fan_section,
                  tickets_in_hand_restrictions,
                  updated_at
                )
                VALUES (
                  $1,$2,$3,$4,$5,$6,$7,
                  $8,$9,$10,$11,$12,$13,$14,
                  NOW()
                )
                `,
                [
                  cleanRow["Slug"] || null,
                  cleanRow["Event ID"] || null,
                  cleanRow["Event Name (Today)"] || null,
                  cleanRow["Event Type"] || null,
                  cleanRow["Event Date"] || null,
                  cleanRow["City"] || null,
                  cleanRow["Venue"] || null,
                  String(cleanRow["New Category Allowed"] || "")
                    .toUpperCase()
                    .trim() === "YES",
                  String(cleanRow["New Section Allowed"] || "")
                    .toUpperCase()
                    .trim() === "YES",
                  cleanRow["Category"] || null,
                  cleanRow["Section"] || null,
                  cleanRow["Spectator Stand"] || null,
                  cleanRow["Fan Section"] || null,
                  cleanRow["Tickets In Hand Restrictions"] || null,
                ],
              );

              imported++;
            }

            await client.query("COMMIT");

            fs.unlinkSync(req.file.path);

            return res.json({
              success: true,
              imported,
            });
          } catch (error) {
            await client.query("ROLLBACK");
            console.error(error);

            return res.status(500).json({
              error: error.message,
            });
          } finally {
            client.release();
          }
        });
    } catch (error) {
      client.release();

      return res.status(500).json({
        error: error.message,
      });
    }
  },
);

router.get(
  "/ticombo/catalog",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { q = "" } = req.query;

      const statsResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total_records,
          COUNT(DISTINCT remote_event_id)::int AS unique_events,
          COUNT(DISTINCT category)::int AS unique_categories
        FROM ticombo_event_catalog
      `);

      const values = [];
      let whereClause = "";

      if (q) {
        values.push(`%${q}%`);

        whereClause = `
          WHERE event_name ILIKE $1
             OR slug ILIKE $1
             OR category ILIKE $1
             OR section ILIKE $1
        `;
      }

      const itemsResult = await pool.query(
        `
        SELECT
          id,
          slug,
          remote_event_id,
          event_name,
          event_date,
          city,
          venue,
          category,
          section
        FROM ticombo_event_catalog
        ${whereClause}
        ORDER BY event_date ASC NULLS LAST, event_name ASC, category ASC
        LIMIT 30
        `,
        values,
      );

      res.json({
        stats: statsResult.rows[0],
        items: itemsResult.rows,
      });
    } catch (error) {
      console.error("Errore catalogo Ticombo:", error);

      res.status(500).json({
        error: "Errore lettura catalogo Ticombo",
      });
    }
  },
);
router.post(
  "/ticombo/catalog/auto-match-event/:eventId",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { eventId } = req.params;

      const eventResult = await pool.query(
        `
        SELECT *
        FROM events
        WHERE id = $1
        LIMIT 1
        `,
        [eventId],
      );

      if (eventResult.rows.length === 0) {
        return res.status(404).json({
          error: "Evento Inventory non trovato",
        });
      }

      const event = eventResult.rows[0];

      const matchResult = await pool.query(
        `
        SELECT
          remote_event_id,
          slug,
          event_name,
          event_date,
          city,
          venue,
          COUNT(*)::int AS rows_count
        FROM ticombo_event_catalog
        WHERE event_name ILIKE '%' || $1 || '%'
           OR $1 ILIKE '%' || event_name || '%'
        GROUP BY remote_event_id, slug, event_name, event_date, city, venue
        ORDER BY
          ABS(EXTRACT(EPOCH FROM (event_date - $2::timestamp))) ASC NULLS LAST
        LIMIT 5
        `,
        [event.name, event.event_date],
      );

      if (matchResult.rows.length === 0) {
        return res.status(404).json({
          error: "Nessun match Ticombo trovato nel catalogo",
          event,
        });
      }

      const bestMatch = matchResult.rows[0];

      const existingMappingResult = await pool.query(
        `
  SELECT *
  FROM marketplace_mappings
  WHERE marketplace = $1
    AND mapping_type = $2
    AND internal_event_id = $3
    AND remote_event_id = $4
  LIMIT 1
  `,
        ["ticombo", "event", event.id, bestMatch.remote_event_id],
      );

      let mappingResult;

      if (existingMappingResult.rows.length > 0) {
        mappingResult = existingMappingResult;
      } else {
        mappingResult = await pool.query(
          `
          INSERT INTO marketplace_mappings (
            marketplace,
            mapping_type,
            internal_event_id,
            remote_event_id,
            remote_event_name,
            notes,
            is_active
          )
          VALUES ($1,$2,$3,$4,$5,$6,true)
          RETURNING *
          `,
          [
            "ticombo",
            "event",
            event.id,
            bestMatch.remote_event_id,
            bestMatch.event_name,
            `Auto-match Ticombo catalog slug: ${bestMatch.slug}`,
          ],
        );
      }

      return res.json({
        success: true,
        event,
        bestMatch,
        alternatives: matchResult.rows,
        mapping: mappingResult.rows[0],
      });
    } catch (error) {
      console.error("Errore auto-match Ticombo:", error);

      return res.status(500).json({
        error: "Errore auto-match Ticombo",
        details: error.message,
      });
    }
  },
);
router.post(
  "/ticombo/catalog/auto-match-ticket/:ticketId",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { ticketId } = req.params;

      const ticketResult = await pool.query(
        `
        SELECT
          t.*,
          e.name AS event_name,
          e.event_date
        FROM tickets t
        JOIN events e ON e.id = t.event_id
        WHERE t.id = $1
        LIMIT 1
        `,
        [ticketId],
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({
          error: "Ticket Inventory non trovato",
        });
      }

      const ticket = ticketResult.rows[0];

      const eventMappingResult = await pool.query(
        `
        SELECT *
        FROM marketplace_mappings
        WHERE marketplace = 'ticombo'
          AND mapping_type = 'event'
          AND internal_event_id = $1
          AND is_active = true
        ORDER BY id DESC
        LIMIT 1
        `,
        [ticket.event_id],
      );

      if (eventMappingResult.rows.length === 0) {
        return res.status(400).json({
          error: "Evento non ancora mappato su Ticombo",
          details: "Esegui prima Auto-Match Ticombo sull'evento",
        });
      }

      const eventMapping = eventMappingResult.rows[0];

      const hasBlock = Boolean(ticket.block && String(ticket.block).trim());

      const catalogResult = await pool.query(
        `
        SELECT *
        FROM ticombo_event_catalog
        WHERE remote_event_id = $1
          AND LOWER(category) = LOWER($2)
          AND (
            $3::text IS NULL
            OR section ILIKE '%' || $3 || '%'
          )
        ORDER BY
          CASE
            WHEN $3::text IS NOT NULL AND section ILIKE '%' || $3 || '%' THEN 0
            ELSE 1
          END,
          category ASC
        LIMIT 1
        `,
        [
          eventMapping.remote_event_id,
          ticket.category,
          hasBlock ? String(ticket.block).trim() : null,
        ],
      );

      if (catalogResult.rows.length === 0) {
        return res.status(404).json({
          error: "Nessuna categoria Ticombo compatibile trovata",
          ticket: {
            id: ticket.id,
            event_id: ticket.event_id,
            category: ticket.category,
            block: ticket.block,
          },
        });
      }

      const match = catalogResult.rows[0];

      const mappingType = hasBlock ? "category_block" : "category";

      const mappingResult = await pool.query(
        `
        INSERT INTO marketplace_mappings (
          marketplace,
          mapping_type,
          internal_event_id,
          internal_category,
          internal_block,
          remote_event_id,
          remote_event_name,
          remote_category_name,
          remote_block_name,
          notes,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
        RETURNING *
        `,
        [
          "ticombo",
          mappingType,
          ticket.event_id,
          ticket.category || null,
          hasBlock ? ticket.block : null,
          eventMapping.remote_event_id,
          match.event_name,
          match.category,
          hasBlock ? ticket.block : null,
          `Auto-match Ticombo catalog category: ${match.category}${
            hasBlock ? ` / block: ${ticket.block}` : ""
          } / slug: ${match.slug}`,
        ],
      );

      return res.json({
        success: true,
        ticket,
        eventMapping,
        match,
        mapping: mappingResult.rows[0],
      });
    } catch (error) {
      console.error("Errore auto-match ticket Ticombo:", error);

      return res.status(500).json({
        error: "Errore auto-match categoria/block Ticombo",
        details: error.message,
      });
    }
  },
);

module.exports = router;
