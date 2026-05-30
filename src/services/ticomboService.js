const axios = require("axios");

function getTicomboConfig() {
  const env = (process.env.TICOMBO_ENV || "uat").toLowerCase();
  const isProduction = env === "prod" || env === "production";

  const baseURL = isProduction
    ? process.env.TICOMBO_PROD_BASE_URL
    : process.env.TICOMBO_UAT_BASE_URL;

  const token = isProduction
    ? process.env.TICOMBO_PROD_API_TOKEN
    : process.env.TICOMBO_UAT_API_TOKEN;

  if (!baseURL || !token) {
    throw new Error(`Ticombo API base URL or token missing for env=${env}`);
  }

  return {
    environment: isProduction ? "prod" : "uat",
    baseURL,
    token,
  };
}

function getTicomboClient() {
  const config = getTicomboConfig();

  return axios.create({
    baseURL: config.baseURL,
    headers: {
      "x-api-key": config.token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 20000,
  });
}

function normalizeTicomboEvent(event) {
  const eventId =
    event.eventId ||
    event.id ||
    event.event_id ||
    event.remote_event_id ||
    null;

  const name =
    event.eventName || event.name || event.title || event.event_name || null;

  const venue =
    event.eventVenue ||
    event.venue?.name ||
    event.venueName ||
    event.venue_name ||
    "-";

  const city =
    event.city ||
    event.venue?.city ||
    event.eventCity ||
    event.eventVenue ||
    "-";

  const date =
    event.eventDate ||
    event.date?.localStart ||
    event.date?.start ||
    event.startDate ||
    event.start_date ||
    event.datetime ||
    null;

  return {
    marketplace: "ticombo",
    id: eventId,
    eventId,
    remote_event_id: eventId,
    name,
    venue,
    city,
    date,
    ticketCategories: event.ticketCategories || event.categories || [],
    ticketSections: event.ticketSections || event.sections || [],
    raw: event,
  };
}

async function searchTicomboEvents(query = "") {
  const client = getTicomboClient();
  const config = getTicomboConfig();

  const cleanQuery = String(query || "").trim();
  const limit = 100;
  const maxPages = 10;
  const allEvents = [];
  let lastMeta = null;
  let lastStatus = null;
  let lastDataType = null;
  let lastKeys = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await client.get("/events", {
      params: {
        page,
        limit,
        status: "Active",
        name: cleanQuery || undefined,
      },
    });

    const pageEvents =
      response.data?.data ||
      response.data?.events ||
      response.data?.results ||
      response.data ||
      [];

    lastMeta = response.data?.meta || null;
    lastStatus = response.status;
    lastDataType = Array.isArray(response.data)
      ? "array"
      : typeof response.data;
    lastKeys =
      response.data && typeof response.data === "object"
        ? Object.keys(response.data)
        : [];

    if (Array.isArray(pageEvents)) {
      allEvents.push(...pageEvents);
    }

    if (!Array.isArray(pageEvents) || pageEvents.length < limit) {
      break;
    }
  }

  console.log("TICOMBO EVENT SEARCH:", {
    environment: config.environment,
    baseURL: config.baseURL,
    query: cleanQuery,
    status: lastStatus,
    rawMeta: lastMeta,
    pagesFetched: Math.ceil(allEvents.length / limit),
    totalFetched: allEvents.length,
    dataType: lastDataType,
    keys: lastKeys,
  });

  const normalized = Array.isArray(allEvents)
    ? allEvents.map(normalizeTicomboEvent)
    : [];

  if (!cleanQuery) return normalized;

  const q = cleanQuery.toLowerCase();

  return normalized.filter((event) => {
    return (
      String(event.name || "")
        .toLowerCase()
        .includes(q) ||
      String(event.venue || "")
        .toLowerCase()
        .includes(q) ||
      String(event.city || "")
        .toLowerCase()
        .includes(q) ||
      String(event.id || "")
        .toLowerCase()
        .includes(q)
    );
  });
}

async function getTicomboEventById(eventId) {
  const client = getTicomboClient();

  const response = await client.get(`/events/${eventId}`);

  return response.data;
}

module.exports = {
  searchTicomboEvents,
  getTicomboEventById,
};
