const { getTicomboClient } = require("./ticomboApi");

function normalizeTicomboEvent(event) {
  return {
    marketplace: "ticombo",
    remote_event_id: event.eventId,
    name: event.name,
    safe_url_name: event.safeUrlName,
    status: event.status,
    category: event.category,
    subcategory: event.subcategory,
    venue_name: event.venue?.name || null,
    venue_id: event.venue?.venueId || null,
    city: event.location?.city || null,
    country: event.location?.country || null,
    start_date: event.date?.start || null,
    timezone: event.date?.timezone || null,
    ticket_types: (event.ticketTypes || []).map((type) => ({
      id: type._id,
      name: type.name,
      sections: type.sections || [],
    })),
    raw: event,
  };
}

async function searchTicomboEvents(query = "") {
  const client = getTicomboClient();

  const response = await client.get("/qa/discovery/widgets/top-entities", {
    params: query ? { q: query } : {},
  });

  const payload = response.data?.payload || response.data;

  const events = payload?.events?.results || payload?.results || [];

  return events.map(normalizeTicomboEvent);
}

module.exports = {
  searchTicomboEvents,
  normalizeTicomboEvent,
};
