const pool = require("../db");

const createAuditLog = require("./auditLogService");
const { createNotification } = require("./notificationService");

async function cleanupExpiredReservations() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const expiredReservations = await client.query(
      `
      SELECT *
      FROM reservations
      WHERE status IN ('pending', 'reserved')
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
      FOR UPDATE
      `
    );

    if (expiredReservations.rows.length === 0) {
      await client.query("COMMIT");
      return;
    }

    for (const reservation of expiredReservations.rows) {
      /**
       * Rilascia stock
       */
      await client.query(
        `
        UPDATE tickets
        SET
          available_quantity = available_quantity + $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [
          reservation.quantity,
          reservation.ticket_id
        ]
      );

      /**
       * Aggiorna reservation
       */
      await client.query(
        `
        UPDATE reservations
        SET
          status = 'expired',
          updated_at = NOW()
        WHERE id = $1
        `,
        [reservation.id]
      );

      /**
       * Audit log
       */
      await createAuditLog({
        client_id: null,
        action: "EXPIRE_RESERVATION",
        resource_type: "reservation",
        resource_id: reservation.id.toString(),
        metadata: {
          reservation_code: reservation.reservation_code,
          ticket_id: reservation.ticket_id,
          quantity: reservation.quantity,
          user_id: reservation.user_id
        }
      });

      /**
       * Notification
       */
      if (reservation.user_id) {
        await createNotification({
          user_id: reservation.user_id,
          type: "RESERVATION_EXPIRED",
          title: "Reservation scaduta",
          message: `La reservation ${reservation.reservation_code} è scaduta e lo stock è stato rilasciato.`,
          metadata: {
            reservation_code: reservation.reservation_code,
            ticket_id: reservation.ticket_id,
            quantity: reservation.quantity
          }
        });
      }
    }

    await client.query("COMMIT");

    console.log(
      `Expired reservations processed: ${expiredReservations.rows.length}`
    );

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Errore cleanupExpiredReservations:",
      error
    );

  } finally {
    client.release();
  }
}

module.exports = cleanupExpiredReservations;