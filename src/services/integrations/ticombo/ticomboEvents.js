const { getTicomboClient } = require("./ticomboApi");

function normalizeTicomboEvent(event) {
  return {
    marketplace: "ticombo",
    id: event.eventId,
    eventId: event.eventId,
    remote_event_id: event.eventId,
    name: event.eventName || event.name,
    venue: event.eventVenue || event.venue?.name || "-",
    city: event.eventVenue || "-",
    date: event.eventDate || event.date?.start || null,
    ticketCategories: event.ticketCategories || [],
    ticketSections: event.ticketSections || [],
    raw: event,
  };
}

async function searchTicomboEvents(query = "") {
  const client = getTicomboClient();

  const response = await client.get("/sellerStats", {
    params: {
      page: 1,
      limit: 50,
    },
  });

  const events = response.data?.data || [];

  const normalized = events.map(normalizeTicomboEvent);

  if (!query) return normalized;

  const q = query.toLowerCase();

  return normalized.filter((event) => {
    return (
      String(event.name || "")
        .toLowerCase()
        .includes(q) ||
      String(event.venue || "")
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
