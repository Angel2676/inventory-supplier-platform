const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");

const router = express.Router();

const pool = require("../db");
const { calculateSafePrice } = require("../services/priceCheckerService");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

const createAuditLog = require("../services/auditLogService");
const { calculatePrice } = require("../services/pricingService");

const upload = multer({ dest: "uploads/" });

/**
 * CREATE ticket
 * super_admin + inventory_manager
 */
router.post(
  "/",
  authJwt,
  requireRole("super_admin", "inventory_manager"),
  async (req, res) => {
    try {
      const {
        event_id,
        supplier_ticket_id,
        category,
        block,
        row_name,
        seat_from,
        seat_to,
        quantity,
        price,
        marketplace_price,
        currency,
      } = req.body;

      if (
        !event_id ||
        !supplier_ticket_id ||
        !category ||
        !quantity ||
        !price
      ) {
        return res.status(400).json({
          error: "Campi obbligatori mancanti",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO tickets (
          event_id,
          supplier_ticket_id,
          category,
          block,
          row_name,
          seat_from,
          seat_to,
          quantity,
          available_quantity,
          price,
        marketplace_price,
        currency,
          status
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,
          $8,$8,$9,$10,$11,'available'
        )
        RETURNING *
        `,
        [
          Number(event_id),
          supplier_ticket_id,
          category,
          block || null,
          row_name || null,
          seat_from || null,
          seat_to || null,
          Number(quantity),
          Number(price),
          marketplace_price !== undefined && marketplace_price !== null
            ? Number(marketplace_price)
            : Number(price),
          currency || "EUR",
        ],
      );

      await createAuditLog({
        client_id: null,
        action: "CREATE_TICKET",
        resource_type: "ticket",
        resource_id: result.rows[0].id.toString(),
        metadata: {
          user_id: req.user.id,
          supplier_ticket_id: result.rows[0].supplier_ticket_id,
          category: result.rows[0].category,
          price: result.rows[0].price,
        },
      });

      res.status(201).json({
        message: "Ticket creato correttamente",
        ticket: result.rows[0],
      });
    } catch (error) {
      console.error("Errore POST /api/tickets:", error);

      res.status(500).json({
        error: "Errore creazione ticket",
      });
    }
  },
);

/**
 * GET tickets
 */
router.get("/", authJwt, async (req, res) => {
  try {
    const {
      event_id,
      supplier_ticket_id,
      category,
      status,
      min_price,
      max_price,
      page = 1,
      limit = 20,
    } = req.query;

    let query = `
      SELECT tickets.*
      FROM tickets
      WHERE 1=1
      AND tickets.status != 'deleted'
    `;

    const values = [];
    let paramCount = 1;

    if (req.user.role !== "super_admin") {
      query += `
        AND tickets.event_id IN (
          SELECT event_id
          FROM partner_event_access
          WHERE user_id = $${paramCount}
        )
      `;

      values.push(req.user.id);
      paramCount++;
    }

    if (event_id) {
      query += ` AND tickets.event_id = $${paramCount}`;
      values.push(Number(event_id));
      paramCount++;
    }

    if (supplier_ticket_id) {
      query += ` AND tickets.supplier_ticket_id ILIKE $${paramCount}`;
      values.push(`%${supplier_ticket_id}%`);
      paramCount++;
    }

    if (category) {
      query += ` AND tickets.category ILIKE $${paramCount}`;
      values.push(`%${category}%`);
      paramCount++;
    }

    if (status) {
      query += ` AND tickets.status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }

    if (min_price) {
      query += ` AND tickets.price >= $${paramCount}`;
      values.push(Number(min_price));
      paramCount++;
    }

    if (max_price) {
      query += ` AND tickets.price <= $${paramCount}`;
      values.push(Number(max_price));
      paramCount++;
    }

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 20;
    const offset = (pageNumber - 1) * limitNumber;

    query += `
      ORDER BY tickets.id DESC
      LIMIT $${paramCount}
      OFFSET $${paramCount + 1}
    `;

    values.push(limitNumber, offset);

    const result = await pool.query(query, values);

    const ticketsWithPricing = await Promise.all(
      result.rows.map(async (ticket) => {
        const finalPrice = await calculatePrice({
          ticket,
          userId: req.user.id,
        });

        return {
          ...ticket,
          base_price: ticket.price,
          final_price: finalPrice,
        };
      }),
    );

    res.json({
      page: pageNumber,
      limit: limitNumber,
      count: ticketsWithPricing.length,
      tickets: ticketsWithPricing,
    });
  } catch (error) {
    console.error("Errore GET /api/tickets:", error);

    res.status(500).json({
      error: "Errore recupero tickets",
    });
  }
});

/**
 * UPDATE ticket
 * super_admin + inventory_manager
 */
router.patch(
  "/:id",
  authJwt,
  requireRole("super_admin", "inventory_manager"),
  async (req, res) => {
    try {
      const ticketId = req.params.id;

      const {
        category,
        block,
        row_name,
        seat_from,
        seat_to,
        quantity,
        available_quantity,
        price,
        partner_price,
        marketplace_price,
        currency,
        status,
        notes,
        low_stock_threshold,
      } = req.body;

      const result = await pool.query(
        `
        UPDATE tickets
        SET
          category = COALESCE($1, category),
          block = COALESCE($2, block),
          row_name = COALESCE($3, row_name),
          seat_from = COALESCE($4, seat_from),
          seat_to = COALESCE($5, seat_to),
          quantity = COALESCE($6, quantity),
          available_quantity = COALESCE($7, available_quantity),

          price = COALESCE($8, price),
          partner_price = COALESCE($9, partner_price),
          marketplace_price = COALESCE($10, marketplace_price),
          currency = COALESCE($11, currency),
          status = COALESCE($12, status),
          notes = COALESCE($13, notes),
          low_stock_threshold = COALESCE($14, low_stock_threshold),
          updated_at = NOW()
        WHERE id = $15
        RETURNING *
        `,
        [
          category || null,
          block || null,
          row_name || null,
          seat_from || null,
          seat_to || null,
          quantity !== undefined ? Number(quantity) : null,
          available_quantity !== undefined ? Number(available_quantity) : null,
          price !== undefined ? Number(price) : null,
          partner_price !== undefined && partner_price !== null
            ? Number(partner_price)
            : null,
          marketplace_price !== undefined && marketplace_price !== null
            ? Number(marketplace_price)
            : null,
          currency || null,
          status || null,
          notes || null,
          low_stock_threshold !== undefined
            ? Number(low_stock_threshold)
            : null,
          ticketId,
        ],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Ticket non trovato",
        });
      }

      await createAuditLog({
        client_id: null,
        action: "UPDATE_TICKET",
        resource_type: "ticket",
        resource_id: result.rows[0].id.toString(),
        metadata: {
          user_id: req.user.id,
          updated_fields: req.body,
          supplier_ticket_id: result.rows[0].supplier_ticket_id,
        },
      });

      res.json({
        message: "Ticket aggiornato correttamente",
        ticket: result.rows[0],
      });
    } catch (error) {
      console.error("Errore PATCH /api/tickets/:id:", error);

      res.status(500).json({
        error: "Errore aggiornamento ticket",
      });
    }
  },
);

/**
 * DELETE ticket (soft delete)
 * super_admin + inventory_manager
 */
router.delete(
  "/:id",
  authJwt,
  requireRole("super_admin", "inventory_manager"),
  async (req, res) => {
    try {
      const ticketId = req.params.id;

      const result = await pool.query(
        `
        UPDATE tickets
        SET
          status = 'deleted',
          available_quantity = 0,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [ticketId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Ticket non trovato",
        });
      }

      await createAuditLog({
        client_id: null,
        action: "DELETE_TICKET",
        resource_type: "ticket",
        resource_id: result.rows[0].id.toString(),
        metadata: {
          user_id: req.user.id,
          supplier_ticket_id: result.rows[0].supplier_ticket_id,
          category: result.rows[0].category,
          deletion_type: "soft_delete",
        },
      });

      res.json({
        message: "Ticket eliminato correttamente",
        deleted_ticket: result.rows[0],
      });
    } catch (error) {
      console.error("Errore DELETE /api/tickets/:id:", error);

      res.status(500).json({
        error: "Errore eliminazione ticket",
      });
    }
  },
);

/**
 * BULK upload CSV
 * super_admin + inventory_manager
 */
router.post(
  "/bulk-upload",
  authJwt,
  requireRole("super_admin", "inventory_manager"),
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
        .pipe(csv())
        .on("data", (row) => {
          rows.push(row);
        })
        .on("end", async () => {
          try {
            await client.query("BEGIN");

            const insertedTickets = [];

            for (const row of rows) {
              let eventId = row.event_id ? Number(row.event_id) : null;

              if (!eventId) {
                if (!row.event_name || !row.event_date) {
                  throw new Error(
                    "event_id mancante: event_name ed event_date sono obbligatori per creare/trovare l'evento",
                  );
                }

                const eventLookup = await client.query(
                  `
      SELECT *
      FROM events
      WHERE LOWER(name) = LOWER($1)
        AND event_date = $2
        AND LOWER(COALESCE(venue, '')) = LOWER(COALESCE($3, ''))
        AND LOWER(COALESCE(city, '')) = LOWER(COALESCE($4, ''))
      LIMIT 1
      `,
                  [
                    row.event_name,
                    row.event_date,
                    row.venue || null,
                    row.city || null,
                  ],
                );

                if (eventLookup.rows.length > 0) {
                  eventId = eventLookup.rows[0].id;
                } else {
                  const eventCreate = await client.query(
                    `
        INSERT INTO events (
          name,
          event_date,
          venue,
          city,
          country,
          event_type,
          event_subcategory,
          team_name,
          status,
          visibility
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active','public')
        RETURNING *
        `,
                    [
                      row.event_name,
                      row.event_date,
                      row.venue || null,
                      row.city || null,
                      row.country || null,
                      row.event_type || null,
                      row.event_subcategory || null,
                      row.team_name || row.event_name,
                    ],
                  );

                  eventId = eventCreate.rows[0].id;
                }
              }

              const result = await client.query(
                `
    INSERT INTO tickets (
      event_id,
      supplier_ticket_id,
      category,
      block,
      row_name,
      seat_from,
      seat_to,
      quantity,
      available_quantity,
      price,
      marketplace_price,
      min_price,
      auto_reprice_enabled,
      undercut_amount,
      currency,
      status
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$8,$9,$10,$11,$12,$13,$14,'available'
    )
    RETURNING *
    `,
                [
                  eventId,
                  row.supplier_ticket_id,
                  row.category,
                  row.block || null,
                  row.row_name || null,
                  row.seat_from || null,
                  row.seat_to || null,
                  Number(row.quantity),
                  Number(row.price),
                  row.marketplace_price
                    ? Number(row.marketplace_price)
                    : Number(row.price),
                  row.min_price ? Number(row.min_price) : null,
                  String(row.auto_reprice_enabled || "").toLowerCase() ===
                    "true",
                  row.undercut_amount ? Number(row.undercut_amount) : 0.01,
                  row.currency || "EUR",
                ],
              );

              insertedTickets.push(result.rows[0]);
            }

            await client.query("COMMIT");

            fs.unlinkSync(req.file.path);

            await createAuditLog({
              client_id: null,
              action: "BULK_UPLOAD_TICKETS",
              resource_type: "ticket",
              resource_id: "bulk",
              metadata: {
                user_id: req.user.id,
                imported_count: insertedTickets.length,
              },
            });

            res.status(201).json({
              message: "Upload CSV completato correttamente",
              imported_count: insertedTickets.length,
              tickets: insertedTickets,
            });
          } catch (error) {
            await client.query("ROLLBACK");

            console.error("Errore import CSV:", error);

            res.status(500).json({
              error: "Errore importazione CSV",
            });
          } finally {
            client.release();
          }
        });
    } catch (error) {
      client.release();

      console.error("Errore upload CSV:", error);

      res.status(500).json({
        error: "Errore upload CSV",
      });
    }
  },
);
router.patch("/:id/pricing", async (req, res) => {
  try {
    const { id } = req.params;
    const { min_price, auto_reprice_enabled, undercut_amount } = req.body;

    const result = await pool.query(
      `
      UPDATE tickets
      SET
        min_price = COALESCE($1, min_price),
        auto_reprice_enabled = COALESCE($2, auto_reprice_enabled),
        undercut_amount = COALESCE($3, undercut_amount)
      WHERE id = $4
      RETURNING *
      `,
      [min_price, auto_reprice_enabled, undercut_amount, id],
    );
    await pool.query(
      `

  UPDATE marketplace_listings

  SET

    min_price = $1,
    auto_reprice_enabled = $2,
    undercut_amount = $3,
    updated_at = NOW()
  WHERE ticket_id = $4
    AND sync_status = 'synced'
  `,
      [min_price, auto_reprice_enabled, undercut_amount, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Ticket non trovato",
      });
    }

    res.json({
      message: "Pricing aggiornato correttamente",
      ticket: result.rows[0],
    });
  } catch (error) {
    console.error("Errore aggiornamento pricing:", error);
    res.status(500).json({
      error: "Errore aggiornamento pricing",
    });
  }
});

router.post("/:id/price-check", async (req, res) => {
  try {
    const { id } = req.params;
    const { marketLowestPrice } = req.body;

    const result = await pool.query("SELECT * FROM tickets WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Ticket non trovato",
      });
    }

    const ticket = result.rows[0];

    const priceCheck = calculateSafePrice({
      currentPrice: Number(ticket.price),
      marketLowestPrice: Number(marketLowestPrice),
      minPrice: Number(ticket.min_price),
      undercutAmount: Number(ticket.undercut_amount || 0.01),
    });

    await pool.query(
      `
      UPDATE tickets
      SET
        last_market_price = $1,
        last_suggested_price = $2,
        last_reprice_at = NOW()
      WHERE id = $3
      `,
      [marketLowestPrice, priceCheck.suggestedPrice, id],
    );

    res.json({
      ticket_id: ticket.id,
      current_price: ticket.price,
      market_lowest_price: marketLowestPrice,
      min_price: ticket.min_price,
      result: priceCheck,
    });
  } catch (error) {
    console.error("Errore price check:", error);
    res.status(500).json({
      error: "Errore price check",
    });
  }
});

router.post("/:id/reprice", async (req, res) => {
  try {
    const { id } = req.params;
    const { marketLowestPrice } = req.body;

    const result = await pool.query("SELECT * FROM tickets WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Ticket non trovato",
      });
    }

    const ticket = result.rows[0];

    if (!ticket.auto_reprice_enabled) {
      return res.status(400).json({
        error: "Repricing automatico non attivo per questo ticket",
      });
    }

    const priceCheck = calculateSafePrice({
      currentPrice: Number(ticket.price),
      marketLowestPrice: Number(marketLowestPrice),
      minPrice: Number(ticket.min_price),
      undercutAmount: Number(ticket.undercut_amount || 0.01),
    });

    if (!priceCheck.shouldUpdate) {
      await pool.query(
        `
        UPDATE tickets
        SET
          last_market_price = $1,
          last_suggested_price = $2,
          last_reprice_at = NOW()
        WHERE id = $3
        `,
        [marketLowestPrice, priceCheck.suggestedPrice, id],
      );

      return res.json({
        message: "Nessun aggiornamento necessario",
        ticket_id: ticket.id,
        old_price: ticket.price,
        new_price: ticket.price,
        result: priceCheck,
      });
    }

    const updateResult = await pool.query(
      `
      UPDATE tickets
      SET
        marketplace_price = $1,
        last_market_price = $2,
        last_suggested_price = $3,
        last_reprice_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [priceCheck.finalPrice, marketLowestPrice, priceCheck.suggestedPrice, id],
    );

    res.json({
      message: "Prezzo aggiornato correttamente",
      ticket_id: ticket.id,
      old_price: ticket.price,
      new_price: updateResult.rows[0].price,
      result: priceCheck,
      ticket: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Errore repricing:", error);
    res.status(500).json({
      error: "Errore repricing",
    });
  }
});

module.exports = router;
