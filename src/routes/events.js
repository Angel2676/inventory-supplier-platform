const express = require("express");

const router = express.Router();

const pool = require("../db");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

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

    if (
      req.user.role !== "super_admin" &&
      req.user.role !== "sales_manager"
    ) {
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
      error: "Errore recupero eventi"
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
        notes
      } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Il nome evento è obbligatorio"
        });
      }

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
          event_date || null,
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
          notes || null
        ]
      );

      res.status(201).json({
        message: "Evento creato correttamente",
        event: result.rows[0]
      });
    } catch (error) {
      console.error("Errore POST /api/events:", error);

      res.status(500).json({
        error: "Errore creazione evento"
      });
    }
  }
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
        notes
      } = req.body;

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
          event_date || null,
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
          eventId
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Evento non trovato"
        });
      }

      res.json({
        message: "Evento aggiornato correttamente",
        event: result.rows[0]
      });
    } catch (error) {
      console.error("Errore PATCH /api/events/:id:", error);

      res.status(500).json({
        error: "Errore aggiornamento evento"
      });
    }
  }
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
        [eventId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Evento non trovato"
        });
      }

      res.json({
        message: "Evento eliminato correttamente",
        event: result.rows[0]
      });
    } catch (error) {
      console.error("Errore DELETE /api/events/:id:", error);

      res.status(500).json({
        error: "Errore eliminazione evento"
      });
    }
  }
);

/**
 * GET /api/events/:id/tickets
 */
router.get("/:id/tickets", authJwt, async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    if (!eventId) {
      return res.status(400).json({
        error: "ID evento non valido"
      });
    }

    if (
      req.user.role !== "super_admin" &&
      req.user.role !== "sales_manager"
    ) {
      const accessResult = await pool.query(
        `
        SELECT id
        FROM partner_event_access
        WHERE user_id = $1
        AND event_id = $2
        `,
        [req.user.id, eventId]
      );

      if (accessResult.rows.length === 0) {
        return res.status(403).json({
          error: "Non sei autorizzato a vedere questo evento"
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
      [eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/events/:id/tickets:", error);

    res.status(500).json({
      error: "Errore recupero tickets evento"
    });
  }
});

module.exports = router;