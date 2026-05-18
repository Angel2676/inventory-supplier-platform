const express = require("express");

const router = express.Router();

const pool = require("../db");
const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

/**
 * Lista accessi partner-eventi
 */
router.get("/", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        partner_event_access.id,
        partner_event_access.user_id,
        partner_event_access.event_id,
        partner_event_access.created_at,
        users.company_name,
        users.contact_name,
        users.email,
        events.name AS event_name
      FROM partner_event_access
      JOIN users ON users.id = partner_event_access.user_id
      JOIN events ON events.id = partner_event_access.event_id
      ORDER BY partner_event_access.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/partner-event-access:", error);

    res.status(500).json({
      error: "Errore recupero accessi partner eventi"
    });
  }
});

/**
 * Assegna evento a partner singolo
 */
router.post("/", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const { user_id, event_id } = req.body;

    if (!user_id || !event_id) {
      return res.status(400).json({
        error: "user_id e event_id sono obbligatori"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO partner_event_access (
        user_id,
        event_id
      )
      VALUES ($1, $2)
      ON CONFLICT (user_id, event_id) DO NOTHING
      RETURNING *
      `,
      [user_id, event_id]
    );

    res.status(201).json({
      message: "Accesso evento assegnato correttamente",
      access: result.rows[0] || null
    });
  } catch (error) {
    console.error("Errore POST /api/partner-event-access:", error);

    res.status(500).json({
      error: "Errore assegnazione accesso evento"
    });
  }
});

/**
 * Assegna uno o più eventi a tutti i partner/client
 */
router.post(
  "/assign-all",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const { event_ids } = req.body;

      if (!Array.isArray(event_ids) || event_ids.length === 0) {
        return res.status(400).json({
          error: "event_ids deve essere un array non vuoto"
        });
      }

      const cleanEventIds = event_ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (cleanEventIds.length === 0) {
        return res.status(400).json({
          error: "Nessun event_id valido ricevuto"
        });
      }

      const result = await pool.query(
        `
        INSERT INTO partner_event_access (
          user_id,
          event_id
        )
        SELECT
          users.id,
          events.id
        FROM users
        CROSS JOIN events
        WHERE users.role IN ('partner', 'client')
        AND events.id = ANY($1::int[])
        ON CONFLICT (user_id, event_id) DO NOTHING
        RETURNING *
        `,
        [cleanEventIds]
      );

      res.status(201).json({
        message: "Eventi assegnati correttamente a tutti i partner/client",
        inserted_count: result.rowCount,
        assigned_accesses: result.rows
      });
    } catch (error) {
      console.error(
        "Errore POST /api/partner-event-access/assign-all:",
        error
      );

      res.status(500).json({
        error: "Errore assegnazione eventi a tutti i partner"
      });
    }
  }
);

/**
 * Rimuove accesso partner-evento
 */
router.delete("/:id", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const accessId = req.params.id;

    const result = await pool.query(
      `
      DELETE FROM partner_event_access
      WHERE id = $1
      RETURNING *
      `,
      [accessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Accesso non trovato"
      });
    }

    res.json({
      message: "Accesso evento rimosso correttamente",
      deleted_access: result.rows[0]
    });
  } catch (error) {
    console.error("Errore DELETE /api/partner-event-access/:id:", error);

    res.status(500).json({
      error: "Errore rimozione accesso evento"
    });
  }
});

module.exports = router;