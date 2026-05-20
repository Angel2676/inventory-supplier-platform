const pool = require("../db");

/**
 * Riduce la quantità disponibile del ticket master inventory
 * e marca tutti i marketplace collegati come "needs_sync".
 */
async function decreaseInventoryAndMarkMarketplaces({
  ticketId,
  quantity,
  source = "manual",
  marketplace = null,
  referenceId = null,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ticketResult = await client.query(
      `
      SELECT *
      FROM tickets
      WHERE id = $1
      FOR UPDATE
      `,
      [ticketId],
    );

    if (ticketResult.rows.length === 0) {
      throw new Error("Ticket non trovato");
    }

    const ticket = ticketResult.rows[0];

    if (Number(ticket.available_quantity) < Number(quantity)) {
      throw new Error("Quantità disponibile insufficiente");
    }

    const newAvailableQuantity =
      Number(ticket.available_quantity) - Number(quantity);

    const updatedTicket = await client.query(
      `
      UPDATE tickets
      SET
        available_quantity = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [newAvailableQuantity, ticketId],
    );

    const listingsResult = await client.query(
      `
      UPDATE marketplace_listings
      SET
        sync_status = 'needs_sync',
        last_error = NULL,
        last_sync_at = NOW()
      WHERE ticket_id = $1
      RETURNING *
      `,
      [ticketId],
    );

    await client.query(
      `
      INSERT INTO marketplace_sync_logs (
        ticket_id,
        marketplace,
        action,
        status,
        response_payload,
        error_message
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        ticketId,
        marketplace || "all",
        "inventory_decrease",
        "needs_sync",
        {
          source,
          quantity,
          old_available_quantity: ticket.available_quantity,
          new_available_quantity: newAvailableQuantity,
          reference_id: referenceId,
        },
        null,
      ],
    );

    await client.query("COMMIT");

    return {
      ticket: updatedTicket.rows[0],
      affected_marketplace_listings: listingsResult.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Marca tutti i marketplace collegati ad un ticket come da sincronizzare,
 * senza modificare quantità.
 */
async function markMarketplacesForSync(ticketId) {
  const result = await pool.query(
    `
    UPDATE marketplace_listings
    SET
      sync_status = 'needs_sync',
      last_sync_at = NOW()
    WHERE ticket_id = $1
    RETURNING *
    `,
    [ticketId],
  );

  return result.rows;
}

module.exports = {
  decreaseInventoryAndMarkMarketplaces,
  markMarketplacesForSync,
};
