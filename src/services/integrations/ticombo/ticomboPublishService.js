const pool = require("../../../db");

const { createTicomboListing } = require("./ticomboListings");

async function publishTicomboTicket(ticketId) {
  const ticketResult = await pool.query(
    `
    SELECT 
      t.*,
      e.name AS event_name
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    WHERE t.id = $1
    `,
    [ticketId],
  );

  if (ticketResult.rows.length === 0) {
    throw new Error("Ticket non trovato");
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
    LIMIT 1
    `,
    [ticket.event_id],
  );

  if (eventMappingResult.rows.length === 0) {
    throw new Error("Mapping evento Ticombo mancante");
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
        eventMappingResult.rows[0]?.remote_event_id || null,
        errorText,
      ],
    );

    throw new Error(errorText);
  }

  const eventMapping = eventMappingResult.rows[0];
  const categoryMapping = categoryMappingResult.rows[0];

  const quantity = Number(ticket.available_quantity || 0);
  if (quantity <= 0) {
    throw new Error(
      `Impossibile pubblicare su Ticombo: quantità non disponibile per ticket ${ticket.id}`,
    );
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
      inHandDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    price,
    currency: "EUR",
    faceValue: Number(ticket.price || price || 0),
    allowProposals: false,
    refId: `inventory-${ticket.id}`,
    sellingOptions: {
      splitType: "any",
      maxDisplayQuantity: quantity,
    },
  };

  const publishResponse = await createTicomboListing(ticomboPayload);
  const remoteListingId = publishResponse?.data?.listingId || null;

  if (!remoteListingId) {
    throw new Error("Ticombo non ha restituito remote listing id");
  }

  return {
    ticket,
    eventMapping,
    categoryMapping,
    quantity,
    price,
    remoteListingId,
    publishResponse,
  };
}

module.exports = {
  publishTicomboTicket,
};
