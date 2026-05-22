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

function extractEvents(searchResult) {
  if (Array.isArray(searchResult?.items)) return searchResult.items;
  if (Array.isArray(searchResult?.data)) return searchResult.data;
  if (Array.isArray(searchResult)) return searchResult;
  return [];
}

function extractCategories(categories) {
  if (Array.isArray(categories?.data)) return categories.data;
  if (Array.isArray(categories?.items)) return categories.items;
  if (Array.isArray(categories)) return categories;
  return [];
}

async function findBestGigsbergEvent(ticket) {
  let searchResult = await searchEvents({
    keyword: ticket.event_name,
    future_events_only: true,
    per_page: 30,
  });

  let events = extractEvents(searchResult);

  if (events.length === 0 && ticket.city) {
    searchResult = await searchEvents({
      keyword: ticket.event_name,
      city: ticket.city,
      future_events_only: true,
      per_page: 30,
    });

    events = extractEvents(searchResult);
  }

  if (events.length === 0) {
    throw new Error("Nessun evento Gigsberg trovato");
  }

  const localName = normalizeText(ticket.event_name);
  const localCity = normalizeText(ticket.city);

  const exactCityMatch = events.find((event) => {
    return (
      normalizeText(event.name) === localName &&
      (!localCity || normalizeText(event.city).includes(localCity))
    );
  });

  const exactNameMatch = events.find(
    (event) => normalizeText(event.name) === localName,
  );

  return exactCityMatch || exactNameMatch || events[0];
}

async function findBestGigsbergCategory(gigsbergEventId, ticket) {
  const categories = await getEventCategories(gigsbergEventId);
  const list = extractCategories(categories);

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

  const reversePartialMatch = list.find((category) =>
    localCategory.includes(normalizeText(category.name)),
  );

  return exactMatch || partialMatch || reversePartialMatch || list[0];
}

async function createGigsbergListing(ticketId) {
  const ticket = await getTicketWithEvent(ticketId);

  const gigsbergEvent = await findBestGigsbergEvent(ticket);

  const gigsbergCategory = await findBestGigsbergCategory(
    gigsbergEvent.id,
    ticket,
  );

  const jwt = await getAuthToken();

  const quantity = Number(ticket.available_quantity || ticket.quantity || 0);

  if (!quantity || quantity <= 0) {
    throw new Error("Quantità ticket non valida");
  }

  const priceCheck = calculateSafePrice({
    currentPrice: Number(
      ticket.marketplace_price ||
        ticket.final_price ||
        ticket.partner_price ||
        ticket.price ||
        0,
    ),
    marketLowestPrice: Number(ticket.last_market_price || 0),
    minPrice: Number(ticket.min_price || 0),
    undercutAmount: Number(ticket.undercut_amount || 0.01),
  });

  const price = priceCheck.shouldUpdate
    ? Number(priceCheck.finalPrice)
    : Number(
        ticket.marketplace_price || ticket.final_price || ticket.price || 0,
      );

  if (!price || price <= 0) {
    throw new Error("Prezzo ticket non valido");
  }

  const faceValue = Number(ticket.face_value || ticket.price || price || 1);

  const categoryId = gigsbergCategory.id || gigsbergCategory.category_id;

  if (!categoryId) {
    throw new Error("category_id Gigsberg mancante");
  }

  console.log("GIGSBERG MATCH:", {
    ticketId: ticket.id,
    eventName: ticket.event_name,
    gigsbergEventId: gigsbergEvent.id,
    gigsbergEventName: gigsbergEvent.name,
    gigsbergCity: gigsbergEvent.city,
    gigsbergVenue: gigsbergEvent.venue,
    localCategory: ticket.category,
    gigsbergCategoryId: categoryId,
    gigsbergCategoryName: gigsbergCategory.name,
  });

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

  const form = new FormData();

  form.append("event_id", gigsbergEvent.id);
  form.append("category_id", categoryId);
  form.append("block", ticket.block || "");
  form.append("row", ticket.row_name || "");
  form.append(
    "seat_start",

    Number(ticket.seat_from || 1),
  );
  form.append(
    "seat_end",

    Number(ticket.seat_to || ticket.seat_from || quantity),
  );
  form.append("face_value", faceValue);
  form.append("price", price);
  form.append("currency_id", getCurrencyId("EUR"));
  form.append("face_value_currency", getCurrencyId("EUR"));
  form.append("quantity", quantity);
  form.append("presented_quantity", quantity);

  form.append(
    "ticket_type_id",
    process.env.GIGSBERG_DEFAULT_TICKET_TYPE_ID || 3,
  );

  form.append("listing_split_type_code", "pairs");
  form.append("is_seller_connected_to_event", 0);
  form.append("active", 1);

  if (process.env.GIGSBERG_ADDRESS_ID) {
    form.append("address_id", process.env.GIGSBERG_ADDRESS_ID);
  }

  if (process.env.GIGSBERG_PRESENT_ADDRESS_ID) {
    form.append("present_address_id", process.env.GIGSBERG_PRESENT_ADDRESS_ID);
  }

  let response;

  try {
    response = await axios.post(`${GIGSBERG_BASE_URL}/listing`, form, {
      headers: {
        ...form.getHeaders(),
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
      },
    });
  } catch (error) {
    console.error(
      "GIGSBERG CREATE LISTING ERROR:",
      JSON.stringify(error.response?.data || error.message, null, 2),
    );

    throw error;
  }

  return {
    response: response.data,
    gigsberg_event_id: gigsbergEvent.id,
    gigsberg_category_id: categoryId,
    gigsberg_event: gigsbergEvent,
    gigsberg_category: gigsbergCategory,
    price_check: priceCheck,
  };
}

module.exports = {
  createGigsbergListing,
};
