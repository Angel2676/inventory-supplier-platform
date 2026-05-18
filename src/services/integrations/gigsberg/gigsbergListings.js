const FormData = require("form-data");
const axios = require("axios");
const pool = require("../../../db");

const { calculateSafePrice } = require("../../priceCheckerService");

const {
  getAuthToken,
  searchEvents,
  getEventCategories,
} = require("./gigsbergApi");

const GIGSBERG_BASE_URL =
  process.env.GIGSBERG_BASE_URL || "https://api.gigsberg.com/v1";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getCurrencyId(currency = "EUR") {
  const map = {
    GBP: 1,
    EUR: 2,
    USD: 4,
    AUD: 5,
    PLN: 6,
    CZK: 7,
    ILS: 8,
    CHF: 9,
  };

  return map[currency] || 2;
}

async function getTicketWithEvent(ticketId) {
  const result = await pool.query(
    `
    SELECT
      tickets.*,
      events.name AS event_name,
      events.event_date,
      events.venue,
      events.city,
      events.country,
      events.team_name
    FROM tickets
    JOIN events ON events.id = tickets.event_id
    WHERE tickets.id = $1
    `,
    [ticketId],
  );

  if (result.rows.length === 0) {
    throw new Error("Ticket non trovato");
  }

  return result.rows[0];
}

async function findBestGigsbergEvent(ticket) {
  const searchResult = await searchEvents({
    keyword: ticket.event_name,
    city: ticket.city || undefined,
    venue: ticket.venue || undefined,
    future_events_only: true,
    per_page: 30,
  });

  const events = Array.isArray(searchResult?.data) ? searchResult.data : [];

  if (events.length === 0) {
    throw new Error("Nessun evento Gigsberg trovato");
  }

  const localName = normalizeText(ticket.event_name);

  const exactMatch = events.find(
    (event) => normalizeText(event.name) === localName,
  );

  return exactMatch || events[0];
}

async function findBestGigsbergCategory(gigsbergEventId, ticket) {
  const categories = await getEventCategories(gigsbergEventId);

  const list = Array.isArray(categories?.data)
    ? categories.data
    : Array.isArray(categories)
      ? categories
      : [];

  if (list.length === 0) {
    throw new Error("Nessuna categoria Gigsberg trovata per questo evento");
  }

  const localCategory = normalizeText(ticket.category);

  const exactMatch = list.find(
    (category) => normalizeText(category.name) === localCategory,
  );

  const partialMatch = list.find((category) =>
    normalizeText(category.name).includes(localCategory),
  );

  return exactMatch || partialMatch || list[0];
}

async function createGigsbergListing(ticketId) {
  const ticket = await getTicketWithEvent(ticketId);

  const gigsbergEvent = await findBestGigsbergEvent(ticket);

  const gigsbergCategory = await findBestGigsbergCategory(
    gigsbergEvent.id,
    ticket,
  );

  const jwt = await getAuthToken();

  const quantity = Number(ticket.available_quantity || ticket.quantity || 1);

  /*
    PRICE CHECKER
  */
  const priceCheck = calculateSafePrice({
    currentPrice: Number(ticket.price || 0),
    marketLowestPrice: Number(ticket.last_market_price || 0),
    minPrice: Number(ticket.min_price || 0),
    undercutAmount: Number(ticket.undercut_amount || 0.01),
  });

  const price = priceCheck.shouldUpdate
    ? Number(priceCheck.finalPrice)
    : Number(ticket.final_price || ticket.price || 0);

  console.log("PRICE CHECK RESULT:", {
    ticketId: ticket.id,
    currentPrice: ticket.price,
    marketLowestPrice: ticket.last_market_price,
    minPrice: ticket.min_price,
    suggestedPrice: priceCheck.suggestedPrice,
    finalPrice: price,
    reason: priceCheck.reason,
    shouldUpdate: priceCheck.shouldUpdate,
  });

  const faceValue = Number(ticket.face_value || ticket.price || 1);

  if (!quantity || quantity <= 0) {
    throw new Error("Quantità ticket non valida");
  }

  if (!price || price <= 0) {
    throw new Error("Prezzo ticket non valido");
  }

  const form = new FormData();

  form.append("event_id", gigsbergEvent.id);
  form.append("category_id", gigsbergCategory.id);

  form.append("block", ticket.block || "");
  form.append("row", ticket.row_name || "");

  form.append("seat_start", ticket.seat_from || "");
  form.append("seat_end", ticket.seat_to || "");

  form.append("face_value", faceValue);

  /*
    PREZZO FINALE CALCOLATO DAL PRICE CHECKER
  */
  form.append("price", price);

  form.append("currency_id", getCurrencyId("EUR"));
  form.append("face_value_currency", getCurrencyId("EUR"));

  form.append("quantity", quantity);
  form.append("presented_quantity", quantity);

  /*
    Configurabile via ENV
  */
  form.append(
    "ticket_type_id",
    process.env.GIGSBERG_DEFAULT_TICKET_TYPE_ID || 3,
  );

  form.append("listing_split_type_code", "pairs");

  form.append("is_seller_connected_to_event", 0);

  form.append("active", 1);

  /*
    Address opzionali
  */
  if (process.env.GIGSBERG_ADDRESS_ID) {
    form.append("address_id", process.env.GIGSBERG_ADDRESS_ID);
  }

  if (process.env.GIGSBERG_PRESENT_ADDRESS_ID) {
    form.append("present_address_id", process.env.GIGSBERG_PRESENT_ADDRESS_ID);
  }

  const response = await axios.post(`${GIGSBERG_BASE_URL}/listing`, form, {
    headers: {
      ...form.getHeaders(),
      Accept: "application/json",
      Authorization: `Bearer ${jwt}`,
    },
  });

  return {
    response: response.data,
    gigsberg_event_id: gigsbergEvent.id,
    gigsberg_category_id: gigsbergCategory.id,
    price_check: priceCheck,
  };
}

module.exports = {
  createGigsbergListing,
};
