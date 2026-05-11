const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();
const pool = require("../db");

const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");
const createAuditLog = require("../services/auditLogService");

/**
 * GET /api/reservations
 * super_admin vede tutto
 * partner vede solo le proprie reservations
 */
router.get("/", authJwt, async (req, res) => {
  try {
    let query = `
      SELECT
        reservations.id,
        reservations.reservation_code,
        reservations.status,
        reservations.quantity,
        reservations.expires_at,
        reservations.created_at,
        reservations.confirmed_at,
        reservations.user_id,
        users.company_name,
        users.contact_name,
        users.email,
        tickets.id AS ticket_id,
        tickets.supplier_ticket_id,
        tickets.category,
        tickets.block,
        tickets.price,
        tickets.currency
      FROM reservations
      JOIN tickets ON tickets.id = reservations.ticket_id
      LEFT JOIN users ON users.id = reservations.user_id
    `;

    const values = [];

    if (req.user.role !== "super_admin") {
      query += `
        WHERE reservations.user_id = $1
      `;
      values.push(req.user.id);
    }

    query += `
      ORDER BY reservations.id DESC
      LIMIT 100
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/reservations:", error);

    res.status(500).json({
      error: "Errore recupero prenotazioni"
    });
  }
});

/**
 * POST /api/reservations
 * Solo super_admin crea reservation diretta.
 * I partner devono usare /api/ticket-requests.
 */
router.post("/", authJwt, requireRole("super_admin"), async (req, res) => {
  const client = await pool.connect();

  try {
    const { ticket_id, quantity } = req.body;

    if (!ticket_id || !quantity) {
      return res.status(400).json({
        error: "ticket_id e quantity sono obbligatori"
      });
    }

    await client.query("BEGIN");

    const ticketResult = await client.query(
      `
      SELECT id, available_quantity, status
      FROM tickets
      WHERE id = $1
      FOR UPDATE
      `,
      [ticket_id]
    );

    if (ticketResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "Ticket non trovato"
      });
    }

    const ticket = ticketResult.rows[0];

    if (ticket.status !== "available") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Ticket non disponibile"
      });
    }

    if (ticket.available_quantity < quantity) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Quantità non disponibile",
        available_quantity: ticket.available_quantity
      });
    }

    const reservationCode = `RES-${uuidv4()}`;
    const reservationMinutes = Number(process.env.RESERVATION_MINUTES || 15);

    const reservationResult = await client.query(
      `
      INSERT INTO reservations (
        reservation_code,
        user_id,
        ticket_id,
        quantity,
        status,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'reserved',
        NOW() + ($5 || ' minutes')::interval
      )
      RETURNING
        id,
        reservation_code,
        user_id,
        ticket_id,
        quantity,
        status,
        expires_at,
        created_at
      `,
      [
        reservationCode,
        req.user.id,
        ticket_id,
        quantity,
        reservationMinutes
      ]
    );

    await client.query(
      `
      UPDATE tickets
      SET
        available_quantity = available_quantity - $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [quantity, ticket_id]
    );

    await client.query("COMMIT");

    await createAuditLog({
      client_id: null,
      action: "CREATE_RESERVATION",
      resource_type: "reservation",
      resource_id: reservationResult.rows[0].reservation_code,
      metadata: {
        user_id: req.user.id,
        ticket_id,
        quantity,
        expires_at: reservationResult.rows[0].expires_at
      }
    });

    res.status(201).json({
      message: "Prenotazione creata correttamente",
      reservation: reservationResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Errore POST /api/reservations:", error);

    res.status(500).json({
      error: "Errore creazione prenotazione"
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/reservations/:code/confirm
 * super_admin può confermare.
 */
router.post(
  "/:code/confirm",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const reservationCode = req.params.code;

      await client.query("BEGIN");

      const reservationResult = await client.query(
        `
        SELECT
          id,
          reservation_code,
          user_id,
          ticket_id,
          quantity,
          status,
          expires_at
        FROM reservations
        WHERE reservation_code = $1
        FOR UPDATE
        `,
        [reservationCode]
      );

      if (reservationResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          error: "Prenotazione non trovata"
        });
      }

      const reservation = reservationResult.rows[0];

      if (reservation.status !== "reserved") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Prenotazione non confermabile",
          current_status: reservation.status
        });
      }

      const expiredResult = await client.query(
        `
        SELECT NOW() > $1 AS expired
        `,
        [reservation.expires_at]
      );

      if (expiredResult.rows[0].expired) {
        await client.query(
          `
          UPDATE reservations
          SET status = 'expired'
          WHERE id = $1
          `,
          [reservation.id]
        );

        await client.query(
          `
          UPDATE tickets
          SET
            available_quantity = available_quantity + $1,
            updated_at = NOW()
          WHERE id = $2
          `,
          [reservation.quantity, reservation.ticket_id]
        );

        await client.query("COMMIT");

        return res.status(400).json({
          error: "Prenotazione scaduta",
          status: "expired"
        });
      }

      const confirmedResult = await client.query(
        `
        UPDATE reservations
        SET
          status = 'confirmed',
          confirmed_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [reservation.id]
      );

      const ticketUpdateResult = await client.query(
        `
        UPDATE tickets
        SET
          status = CASE
            WHEN available_quantity = 0 THEN 'sold'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, available_quantity, status
        `,
        [reservation.ticket_id]
      );

      await client.query("COMMIT");

      await createAuditLog({
        client_id: null,
        action: "CONFIRM_RESERVATION",
        resource_type: "reservation",
        resource_id: reservation.reservation_code,
        metadata: {
          user_id: req.user.id,
          ticket_id: reservation.ticket_id,
          quantity: reservation.quantity
        }
      });

      res.json({
        message: "Prenotazione confermata correttamente",
        reservation: confirmedResult.rows[0],
        ticket: ticketUpdateResult.rows[0]
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Errore conferma prenotazione:", error);

      res.status(500).json({
        error: "Errore conferma prenotazione"
      });
    } finally {
      client.release();
    }
  }
);

/**
 * GET /api/reservations/:code
 * super_admin vede tutto
 * partner vede solo la propria reservation
 */
router.get("/:code", authJwt, async (req, res) => {
  try {
    const reservationCode = req.params.code;

    const result = await pool.query(
      `
      SELECT
        reservations.id,
        reservations.reservation_code,
        reservations.status,
        reservations.quantity,
        reservations.expires_at,
        reservations.created_at,
        reservations.confirmed_at,
        reservations.user_id,
        users.company_name,
        users.contact_name,
        users.email,
        tickets.id AS ticket_id,
        tickets.supplier_ticket_id,
        tickets.category,
        tickets.block,
        tickets.row_name,
        tickets.price,
        tickets.currency
      FROM reservations
      JOIN tickets ON tickets.id = reservations.ticket_id
      LEFT JOIN users ON users.id = reservations.user_id
      WHERE reservations.reservation_code = $1
      `,
      [reservationCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Prenotazione non trovata"
      });
    }

    const reservation = result.rows[0];

    if (
      req.user.role !== "super_admin" &&
      reservation.user_id !== req.user.id
    ) {
      return res.status(403).json({
        error: "Questa prenotazione non appartiene a questo utente"
      });
    }

    res.json(reservation);
  } catch (error) {
    console.error("Errore GET /api/reservations/:code:", error);

    res.status(500).json({
      error: "Errore recupero prenotazione"
    });
  }
});

module.exports = router;