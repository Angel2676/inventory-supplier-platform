const { getTicomboClient, getTicomboConfig } = require("./ticomboApi");

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

  const response = await client.get("/events", {
    params: {
      page: 1,
      limit: 100,
      search: cleanQuery || undefined,
      query: cleanQuery || undefined,
      keyword: cleanQuery || undefined,
      q: cleanQuery || undefined,
    },
  });

  console.log("TICOMBO EVENT SEARCH:", {
    environment: config.environment,
    baseURL: config.baseURL,
    query: cleanQuery,
    status: response.status,
    rawMeta: response.data?.meta || null,
    dataType: Array.isArray(response.data) ? "array" : typeof response.data,
    keys:
      response.data && typeof response.data === "object"
        ? Object.keys(response.data)
        : [],
  });

  const events =
    response.data?.data ||
    response.data?.events ||
    response.data?.results ||
    response.data ||
    [];

  const normalized = Array.isArray(events)
    ? events.map(normalizeTicomboEvent)
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

module.exports = {
  searchTicomboEvents,
  normalizeTicomboEvent,
};
