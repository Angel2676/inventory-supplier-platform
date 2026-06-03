const express = require("express");

const router = express.Router();

const pool = require("../db");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");
const sendEmail = require("../services/emailService");

function normalizeAndValidateEventDate(eventDate) {
  if (!eventDate) return null;

  const value = String(eventDate).trim();

  const localDateTimeMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
  );

  if (!localDateTimeMatch) {
    throw new Error("Data evento non valida");
  }

  const [, year, month, day, hour, minute, second = "00"] = localDateTimeMatch;

  const numericYear = Number(year);

  if (numericYear < 2025 || numericYear > 2035) {
    throw new Error(
      "Anno evento non valido. Controllare la data inserita prima di salvare.",
    );
  }

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatDate(value) {
  if (!value) return "Data da confermare";
  return new Date(value).toLocaleString("it-IT");
}

async function notifyPartnersNewEvent(event) {
  if (event.status !== "active" || event.visibility !== "public") {
    return;
  }

  try {
    const partnersResult = await pool.query(
      `
      SELECT
        id,
        email,
        company_name,
        contact_name,
        role
      FROM users
      WHERE email IS NOT NULL
      AND email != ''
      AND role IN ('partner', 'client')
      `,
    );

    const partners = partnersResult.rows;

    if (partners.length === 0) {
      console.log("Nessun partner/client da notificare per nuovo evento");
      return;
    }

    const eventLabel = [
      event.event_type,
      event.event_subcategory,
      event.team_name,
    ]
      .filter(Boolean)
      .join(" · ");

    await Promise.allSettled(
      partners.map((partner) =>
        sendEmail({
          to: partner.email,
          subject: `New event available: ${event.name}`,
          text: `
New event available on SportManiaTravel.

Event: ${event.name}
Category: ${eventLabel || "-"}
Date: ${formatDate(event.event_date)}
Venue: ${event.venue || "-"}
City: ${event.city || "-"}
Country: ${event.country || "-"}

Please log in to your partner dashboard to browse available inventory.
          `,
          html: `
            <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px;">
              <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e5e7eb;">
                
                <div style="background:linear-gradient(135deg,#0f172a,#2563eb); color:#ffffff; padding:28px;">
                  <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-weight:bold;">
                    SportManiaTravel Partner Portal
                  </p>
                  <h1 style="margin:0; font-size:26px;">
                    New event available
                  </h1>
                </div>

                <div style="padding:28px;">
                  <p style="color:#334155; font-size:15px; line-height:1.6;">
                    Gentile ${
                      partner.contact_name || partner.company_name || "Partner"
                    },
                  </p>

                  <p style="color:#334155; font-size:15px; line-height:1.6;">
                    È stato aggiunto un nuovo evento disponibile nella piattaforma SportManiaTravel Inventory.
                  </p>

                  <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:16px; padding:18px; margin:22px 0;">
                    <h2 style="margin:0 0 12px; color:#0f172a; font-size:22px;">
                      ${event.name}
                    </h2>

                    <p style="margin:6px 0; color:#475569;">
                      <strong>Categoria:</strong> ${eventLabel || "-"}
                    </p>

                    <p style="margin:6px 0; color:#475569;">
                      <strong>Data:</strong> ${formatDate(event.event_date)}
                    </p>

                    <p style="margin:6px 0; color:#475569;">
                      <strong>Venue:</strong> ${event.venue || "-"}
                    </p>

                    <p style="margin:6px 0; color:#475569;">
                      <strong>Città:</strong> ${event.city || "-"} ${
                        event.country ? `· ${event.country}` : ""
                      }
                    </p>
                  </div>

                  <p style="color:#334155; font-size:15px; line-height:1.6;">
                    Accedi alla dashboard partner per visualizzare disponibilità, prezzi e categorie ticket.
                  </p>

                  <p style="margin-top:26px;">
                    <a href="${
                      process.env.FRONTEND_URL || "https://sportmaniatravel.net"
                    }"
                       style="display:inline-block; background:#2563eb; color:#ffffff; padding:13px 18px; border-radius:12px; text-decoration:none; font-weight:bold;">
                      Open partner dashboard
                    </a>
                  </p>

                  <p style="color:#94a3b8; font-size:12px; margin-top:28px;">
                    This is an automatic email from SportManiaTravel Inventory Supplier Platform.
                  </p>
                </div>
              </div>
            </div>
          `,
        }),
      ),
    );

    console.log("Email nuovo evento inviate ai partner/client:", {
      event_id: event.id,
      event_name: event.name,
      recipients: partners.length,
    });
  } catch (error) {
    console.error("Errore invio email nuovo evento ai partner:", error);
  }
}

/**
 * GET /api/events
 */
router.get("/", authJwt, async (req, res) => {
  try {
    let query = `
      SELECT *
      FROM events
      WHERE status != 'deleted'
    `;

    const values = [];
    let index = 1;

    if (req.user.role !== "super_admin" && req.user.role !== "sales_manager") {
      query += `
        AND status = 'active'
        AND visibility = 'public'
        AND id IN (
          SELECT event_id
          FROM partner_event_access
          WHERE user_id = $${index}
        )
      `;

      values.push(req.user.id);
      index++;
    }

    query += `
      ORDER BY
        event_type ASC NULLS LAST,
        event_subcategory ASC NULLS LAST,
        team_name ASC NULLS LAST,
        event_date ASC NULLS LAST,
        id DESC
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/events:", error);

    res.status(500).json({
      error: "Errore recupero eventi",
    });
  }
});

/**
 * POST /api/events
 */
router.post(
  "/",
  authJwt,
  requireRole("super_admin", "sales_manager"),
  async (req, res) => {
    try {
      const {
        name,
        event_date,
        venue,
        city,
        country,
        event_type,
        event_subcategory,
        team_name,
        team_logo_url,
        image_url,
        logo_url,
        status = "active",
        visibility = "public",
        notes,
      } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Il nome evento è obbligatorio",
        });
      }
      const validatedEventDate = normalizeAndValidateEventDate(event_date);
      const result = await pool.query(
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
          team_logo_url,
          image_url,
          logo_url,
          status,
          visibility,
          notes
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,
          $10,$11,$12,$13,$14
        )
        RETURNING *
        `,
        [
          name,
          validatedEventDate,
          venue || null,
          city || null,
          country || null,
          event_type || null,
          event_subcategory || null,
          team_name || null,
          team_logo_url || null,
          image_url || null,
          logo_url || null,
          status,
          visibility,
          notes || null,
        ],
      );

      const createdEvent = result.rows[0];

      notifyPartnersNewEvent(createdEvent).catch((error) => {
        console.error("Errore async notifyPartnersNewEvent:", error);
      });

      res.status(201).json({
        message: "Evento creato correttamente",
        event: createdEvent,
      });
    } catch (error) {
      console.error("Errore POST /api/events:", error);

      res.status(500).json({
        error: "Errore creazione evento",
      });
    }
  },
);

/**
 * PATCH /api/events/:id
 */
router.patch(
  "/:id",
  authJwt,
  requireRole("super_admin", "sales_manager"),
  async (req, res) => {
    try {
      const eventId = req.params.id;

      const {
        name,
        event_date,
        venue,
        city,
        country,
        event_type,
        event_subcategory,
        team_name,
        team_logo_url,
        image_url,
        logo_url,
        status,
        visibility,
        notes,
      } = req.body;

      const validatedEventDate =
        event_date !== undefined
          ? normalizeAndValidateEventDate(event_date)
          : undefined;
      const result = await pool.query(
        `
        UPDATE events
        SET
          name = COALESCE($1, name),
          event_date = COALESCE($2, event_date),
          venue = COALESCE($3, venue),
          city = COALESCE($4, city),
          country = COALESCE($5, country),
          event_type = COALESCE($6, event_type),
          event_subcategory = COALESCE($7, event_subcategory),
          team_name = COALESCE($8, team_name),
          team_logo_url = COALESCE($9, team_logo_url),
          image_url = COALESCE($10, image_url),
          logo_url = COALESCE($11, logo_url),
          status = COALESCE($12, status),
          visibility = COALESCE($13, visibility),
          notes = COALESCE($14, notes)
        WHERE id = $15
        RETURNING *
        `,
        [
          name || null,
          validatedEventDate ?? null,
          venue || null,
          city || null,
          country || null,
          event_type || null,
          event_subcategory || null,
          team_name || null,
          team_logo_url || null,
          image_url || null,
          logo_url || null,
          status || null,
          visibility || null,
          notes || null,
          eventId,
        ],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Evento non trovato",
        });
      }

      res.json({
        message: "Evento aggiornato correttamente",
        event: result.rows[0],
      });
    } catch (error) {
      console.error("Errore PATCH /api/events/:id:", error);

      res.status(500).json({
        error: "Errore aggiornamento evento",
      });
    }
  },
);

/**
 * DELETE /api/events/:id
 */
router.delete(
  "/:id",
  authJwt,
  requireRole("super_admin", "sales_manager"),
  async (req, res) => {
    try {
      const eventId = req.params.id;

      const result = await pool.query(
        `
        UPDATE events
        SET status = 'deleted'
        WHERE id = $1
        RETURNING *
        `,
        [eventId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Evento non trovato",
        });
      }

      res.json({
        message: "Evento eliminato correttamente",
        event: result.rows[0],
      });
    } catch (error) {
      console.error("Errore DELETE /api/events/:id:", error);

      res.status(500).json({
        error: "Errore eliminazione evento",
      });
    }
  },
);

/**
 * GET /api/events/:id/tickets
 */
router.get("/:id/tickets", authJwt, async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    if (!eventId) {
      return res.status(400).json({
        error: "ID evento non valido",
      });
    }

    if (req.user.role !== "super_admin" && req.user.role !== "sales_manager") {
      const accessResult = await pool.query(
        `
        SELECT id
        FROM partner_event_access
        WHERE user_id = $1
        AND event_id = $2
        `,
        [req.user.id, eventId],
      );

      if (accessResult.rows.length === 0) {
        return res.status(403).json({
          error: "Non sei autorizzato a vedere questo evento",
        });
      }
    }

    const result = await pool.query(
      `
      SELECT *
      FROM tickets
      WHERE event_id = $1
      AND status != 'deleted'
      ORDER BY id DESC
      `,
      [eventId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/events/:id/tickets:", error);

    res.status(500).json({
      error: "Errore recupero tickets evento",
    });
  }
});

module.exports = router;
