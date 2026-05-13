const express = require("express");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const pool = require("../db");

const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

const createAuditLog = require("../services/auditLogService");
const sendEmail = require("../services/emailService");
const { createNotification } = require("../services/notificationService");
const generateReservationPdf = require("../services/generateReservationPdf");

/**
 * Partner/client crea richiesta ticket
 */
router.post("/", authJwt, async (req, res) => {
  const client = await pool.connect();

  try {
    const { ticket_id, quantity, notes } = req.body;

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

    const pendingResult = await client.query(
      `
      SELECT COALESCE(SUM(quantity), 0)::int AS pending_quantity
      FROM ticket_requests
      WHERE ticket_id = $1
      AND status = 'pending'
      `,
      [ticket_id]
    );

    const pendingQuantity = pendingResult.rows[0].pending_quantity;

    const effectivelyAvailable =
      ticket.available_quantity - pendingQuantity;

    if (effectivelyAvailable < Number(quantity)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Quantità non disponibile considerando richieste pending",
        available_quantity: ticket.available_quantity,
        pending_quantity: pendingQuantity,
        effectively_available: effectivelyAvailable
      });
    }

    const result = await client.query(
      `
      INSERT INTO ticket_requests (
        user_id,
        ticket_id,
        quantity,
        status,
        notes
      )
      VALUES ($1, $2, $3, 'pending', $4)
      RETURNING *
      `,
      [
        req.user.id,
        Number(ticket_id),
        Number(quantity),
        notes || null
      ]
    );

    await createAuditLog({
      client_id: null,
      action: "CREATE_TICKET_REQUEST",
      resource_type: "ticket_request",
      resource_id: result.rows[0].id.toString(),
      metadata: {
        user_id: req.user.id,
        ticket_id: Number(ticket_id),
        quantity: Number(quantity)
      }
    });

    await createNotification({
      role_target: "super_admin",
      type: "TICKET_REQUEST_CREATED",
      title: "Nuova richiesta ticket",
      message: `Nuova richiesta ticket dal partner ${req.user.id}`,
      metadata: {
        user_id: req.user.id,
        ticket_id: Number(ticket_id),
        quantity: Number(quantity)
      }
    });

    await client.query("COMMIT");

    res.status(201).json({
      message: "Richiesta ticket creata correttamente",
      request: result.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Errore POST /api/ticket-requests:", error);

    res.status(500).json({
      error: "Errore creazione richiesta ticket"
    });
  } finally {
    client.release();
  }
});

/**
 * GET richieste
 */
router.get("/", authJwt, async (req, res) => {
  try {
    let query = `
      SELECT
        ticket_requests.*,

        users.company_name,
        users.contact_name,
        users.email,

        tickets.supplier_ticket_id,
        tickets.category,
        tickets.block,
        tickets.row_name,
        tickets.seat_from,
        tickets.seat_to,
        tickets.price,
        tickets.currency,

        events.name AS event_name,
        events.event_date,
        events.venue,
        events.city,
        events.country,
        events.event_type,
        events.event_subcategory

      FROM ticket_requests

      JOIN users
        ON users.id = ticket_requests.user_id

      JOIN tickets
        ON tickets.id = ticket_requests.ticket_id

      LEFT JOIN events
        ON events.id = tickets.event_id
    `;

    const values = [];

    if (req.user.role !== "super_admin") {
      query += `
        WHERE ticket_requests.user_id = $1
      `;

      values.push(req.user.id);
    }

    query += `
      ORDER BY ticket_requests.id DESC
      LIMIT 100
    `;

    const result = await pool.query(query, values);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/ticket-requests:", error);

    res.status(500).json({
      error: "Errore recupero richieste ticket"
    });
  }
});

/**
 * APPROVA richiesta
 */
router.patch(
  "/:id/approve",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const requestId = req.params.id;

      await client.query("BEGIN");

      const requestResult = await client.query(
        `
        SELECT *
        FROM ticket_requests
        WHERE id = $1
        FOR UPDATE
        `,
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Richiesta non trovata"
        });
      }

      const request = requestResult.rows[0];

      if (request.status !== "pending") {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Richiesta non approvabile"
        });
      }

      const ticketResult = await client.query(
        `
        SELECT *
        FROM tickets
        WHERE id = $1
        FOR UPDATE
        `,
        [request.ticket_id]
      );

      if (ticketResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Ticket non trovato"
        });
      }

      const ticket = ticketResult.rows[0];

      if (ticket.available_quantity < request.quantity) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error: "Quantità non disponibile"
        });
      }

      await client.query(
        `
        UPDATE tickets
        SET
          available_quantity = available_quantity - $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [request.quantity, request.ticket_id]
      );

      const reservationCode = `RES-${uuidv4()}`;

      const reservationResult = await client.query(
        `
        INSERT INTO reservations (
          reservation_code,
          user_id,
          ticket_id,
          quantity,
          status,
          expires_at,
          confirmed_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'confirmed',
          NOW() + interval '15 minutes',
          NOW()
        )
        RETURNING *
        `,
        [
          reservationCode,
          request.user_id,
          request.ticket_id,
          request.quantity
        ]
      );

      const approvedResult = await client.query(
        `
        UPDATE ticket_requests
        SET
          status = 'approved',
          approved_at = NOW(),
          approved_by = $1
        WHERE id = $2
        RETURNING *
        `,
        [req.user.id, requestId]
      );

      const userResult = await client.query(
        `
        SELECT
          id,
          company_name,
          contact_name,
          email
        FROM users
        WHERE id = $1
        `,
        [request.user_id]
      );

      const requestUser = userResult.rows[0];

      const detailsResult = await client.query(
        `
        SELECT
          tickets.supplier_ticket_id,
          tickets.category,
          tickets.block,
          tickets.row_name,
          tickets.seat_from,
          tickets.seat_to,
          tickets.price,

          events.name AS event_name,
          events.event_date,
          events.venue,
          events.city,
          events.country,
          events.event_type,
          events.event_subcategory

        FROM tickets

        LEFT JOIN events
          ON events.id = tickets.event_id

        WHERE tickets.id = $1
        `,
        [request.ticket_id]
      );

      const details = detailsResult.rows[0];

      const pdfBuffer = await generateReservationPdf({
        request_id: requestId,
        reservation_code: reservationCode,
        approved_at: new Date(),

        company_name: requestUser.company_name,
        contact_name: requestUser.contact_name,
        email: requestUser.email,

        quantity: request.quantity,
        notes: request.notes,

        ...details
      });

      await client.query("COMMIT");

      await createAuditLog({
        client_id: null,
        action: "APPROVE_TICKET_REQUEST",
        resource_type: "ticket_request",
        resource_id: requestId.toString(),
        metadata: {
          approved_by: req.user.id,
          reservation_code: reservationCode
        }
      });

      await createNotification({
        user_id: request.user_id,
        type: "TICKET_REQUEST_APPROVED",
        title: "Richiesta approvata",
        message: `Richiesta ${requestId} approvata`,
        metadata: {
          request_id: requestId,
          reservation_code: reservationCode
        }
      });

      if (requestUser?.email) {
        await sendEmail({
          to: requestUser.email,

          subject: "Reservation confirmation",

          text: `
La tua richiesta ticket è stata approvata.

Reservation Code:
${reservationCode}
          `,

          html: `
            <div style="font-family: Arial, sans-serif;">
              <h2>SportManiaTravel</h2>

              <p>
                Gentile ${
                  requestUser.contact_name ||
                  requestUser.company_name ||
                  "Partner"
                },
              </p>

              <p>
                La tua richiesta ticket
                <strong>#${requestId}</strong>
                è stata approvata.
              </p>

              <p>
                Reservation Code:
                <strong>${reservationCode}</strong>
              </p>

              <p>
                In allegato trovi il PDF ufficiale
                con tutti i dettagli della reservation.
              </p>
            </div>
          `,

          attachments: [
            {
              filename: `reservation-${reservationCode}.pdf`,
              content: pdfBuffer
            }
          ]
        });
      }

      res.json({
        message: "Richiesta approvata correttamente",
        request: approvedResult.rows[0],
        reservation: reservationResult.rows[0]
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Errore approve ticket request:", error);

      res.status(500).json({
        error: "Errore approvazione richiesta"
      });
    } finally {
      client.release();
    }
  }
);

/**
 * RIFIUTA richiesta
 */
router.patch(
  "/:id/reject",
  authJwt,
  requireRole("super_admin"),
  async (req, res) => {
    try {
      const requestId = req.params.id;

      const { rejection_reason } = req.body;

      const result = await pool.query(
        `
        UPDATE ticket_requests
        SET
          status = 'rejected',
          rejected_at = NOW(),
          rejected_by = $1,
          rejection_reason = $2
        WHERE id = $3
        AND status = 'pending'
        RETURNING *
        `,
        [
          req.user.id,
          rejection_reason || null,
          requestId
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Richiesta non trovata"
        });
      }

      res.json({
        message: "Richiesta rifiutata correttamente",
        request: result.rows[0]
      });
    } catch (error) {
      console.error("Errore reject ticket request:", error);

      res.status(500).json({
        error: "Errore rifiuto richiesta"
      });
    }
  }
);

module.exports = router;