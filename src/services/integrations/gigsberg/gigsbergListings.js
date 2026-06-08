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
function getPreferredGigsbergCategoryName(ticketCategory) {
  const category = normalizeText(ticketCategory);

  if (category === normalizeText("Distinti Superiori")) {
    return "Category 1";
  }

  if (category === normalizeText("Distinti Inferiori")) {
    return "Category 1 Platinum";
  }

  if (
    category === normalizeText("Curva A Inferiore") ||
    category === normalizeText("Curva A Superiore") ||
    category === normalizeText("Curva B Inferiore") ||
    category === normalizeText("Curva B Superiore")
  ) {
    return "Category 2";
  }

  return null;
}

function extractGigsbergEventIdFromPublicUrl(publicUrl) {
  if (!publicUrl) return null;

  const match = String(publicUrl).match(/show-(\d+)/i);

  return match ? match[1] : null;
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

function getDateOnly(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

function getGigsbergEventDate(event) {
  return (
    event.date ||
    event.event_date ||
    event.eventDate ||
    event.start_date ||
    event.startDate ||
    event.start ||
    event.datetime ||
    event.date_time ||
    null
  );
}
async function getGigsbergEventMapping(ticket) {
  const result = await pool.query(
    `
    SELECT
      remote_event_id,
      remote_event_name,
      public_url
    FROM marketplace_mappings
    WHERE marketplace = 'gigsberg'
      AND mapping_type = 'event'
      AND internal_event_id = $1
      AND is_active = true
      AND (
        remote_event_id IS NOT NULL
        OR public_url IS NOT NULL
      )
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [ticket.event_id],
  );

  return result.rows[0] || null;
}

async function findBestGigsbergEvent(ticket) {
  const mappedEvent = await getGigsbergEventMapping(ticket);

  const mappedEventId =
    mappedEvent?.remote_event_id ||
    extractGigsbergEventIdFromPublicUrl(mappedEvent?.public_url);

  if (mappedEventId) {
    return {
      id: mappedEventId,
      name: mappedEvent.remote_event_name || ticket.event_name,
      public_url: mappedEvent.public_url || null,
      mapped: true,
    };
  }

  let searchResult = await searchEvents({
    keyword: ticket.event_name,
    future_events_only: true,
    per_page: 50,
  });

  let events = extractEvents(searchResult);
  if (process.env.DEBUG_GIGSBERG === "true") {
    console.log(
      "GIGSBERG EVENTS FOUND:",
      JSON.stringify(
        events.map((event) => ({
          id: event.id,
          name: event.name,
          date:
            event.date ||
            event.event_date ||
            event.eventDate ||
            event.start_date ||
            event.startDate,
          city: event.city,
          venue: event.venue,
        })),
        null,
        2,
      ),
    );
  }

  if (events.length === 0 && ticket.city) {
    searchResult = await searchEvents({
      keyword: ticket.event_name,
      city: ticket.city,
      future_events_only: true,
      per_page: 50,
    });

    events = extractEvents(searchResult);
  }

  if (events.length === 0) {
    throw new Error("Nessun evento Gigsberg trovato");
  }

  const localName = normalizeText(ticket.event_name);
  const localCity = normalizeText(ticket.city);
  const localVenue = normalizeText(ticket.venue);
  const localDate = getDateOnly(ticket.event_date);

  const candidates = events.filter((event) => {
    const eventName = normalizeText(event.name);
    const eventCity = normalizeText(event.city);
    const eventVenue = normalizeText(event.venue);
    const eventDate = getDateOnly(getGigsbergEventDate(event));

    const nameMatches =
      eventName === localName || eventName.includes(localName);
    const cityMatches = !localCity || eventCity.includes(localCity);
    const venueMatches =
      !localVenue ||
      !eventVenue ||
      eventVenue.includes(localVenue) ||
      localVenue.includes(eventVenue);
    const dateMatches = !localDate || eventDate === localDate;

    return nameMatches && cityMatches && venueMatches && dateMatches;
  });

  if (candidates.length > 0) {
    return candidates[0];
  }

  const sameNameSameDate = events.filter((event) => {
    const eventName = normalizeText(event.name);
    const eventDate = getDateOnly(getGigsbergEventDate(event));

    return (
      (eventName === localName || eventName.includes(localName)) &&
      localDate &&
      eventDate === localDate
    );
  });

  if (sameNameSameDate.length > 0) {
    return sameNameSameDate[0];
  }

  const sameNameDifferentDate = events.find((event) => {
    const eventName = normalizeText(event.name);
    const eventDate = getDateOnly(getGigsbergEventDate(event));

    return (
      (eventName === localName || eventName.includes(localName)) &&
      localDate &&
      eventDate &&
      eventDate !== localDate
    );
  });

  if (sameNameDifferentDate) {
    throw new Error(
      `Evento Gigsberg trovato per "${ticket.event_name}", ma con data diversa. Inventory: ${localDate}, Gigsberg: ${getDateOnly(
        getGigsbergEventDate(sameNameDifferentDate),
      )}. Pubblicazione bloccata.`,
    );
  }

  throw new Error(
    `Nessun evento Gigsberg compatibile trovato per "${ticket.event_name}" in data ${localDate || "N/D"}. Pubblicazione bloccata.`,
  );
}

async function findBestGigsbergCategory(gigsbergEventId, ticket) {
  const categories = await getEventCategories(gigsbergEventId);
  const list = extractCategories(categories);

  if (list.length === 0) {
    throw new Error("Nessuna categoria Gigsberg trovata per questo evento");
  }

  const localCategory = normalizeText(ticket.category);
  const preferredCategoryName = getPreferredGigsbergCategoryName(
    ticket.category,
  );

  if (preferredCategoryName) {
    const preferredMatch = list.find(
      (category) =>
        normalizeText(category.name) === normalizeText(preferredCategoryName),
    );

    if (preferredMatch) {
      return preferredMatch;
    }

    throw new Error(
      `Categoria Gigsberg obbligatoria non trovata: ${preferredCategoryName} per categoria locale ${ticket.category}`,
    );
  }

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

    console.log(
      "GIGSBERG CREATE LISTING RESPONSE:",
      JSON.stringify(response.data, null, 2),
    );
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
