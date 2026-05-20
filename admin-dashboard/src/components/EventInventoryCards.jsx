function EventInventoryCards({
  events = [],
  tickets = [],
  onSelectEvent
}) {
  function formatDate(value) {
    if (!value) return "Date TBC";
    return new Date(value).toLocaleString();
  }

  function getEventTickets(eventId) {
    return tickets.filter(
      (ticket) => Number(ticket.event_id) === Number(eventId)
    );
  }

  function getAvailableQuantity(eventId) {
    return getEventTickets(eventId).reduce(
      (sum, ticket) => sum + Number(ticket.available_quantity || 0),
      0
    );
  }

  function getStartingPrice(eventId) {
    const prices = getEventTickets(eventId)
      .map((ticket) => Number(ticket.final_price || ticket.price || 0))
      .filter((price) => price > 0);

    if (prices.length === 0) return null;

    return Math.min(...prices);
  }

  return (
    <div className="event-cards-grid">
      {events.map((event) => {
        const available = getAvailableQuantity(event.id);
        const startingPrice = getStartingPrice(event.id);

        return (
          <button
            key={event.id}
            className="event-card"
            type="button"
            onClick={() => onSelectEvent(event.id)}
          >
            <div
              className="event-card-image"
              style={{
                backgroundImage: event.image_url
                  ? `url(${event.image_url})`
                  : "linear-gradient(135deg, #0f172a, #2563eb)"
              }}
            >
              {event.logo_url && (
                <img
                  src={event.logo_url}
                  alt={event.name}
                  className="event-card-logo"
                />
              )}

              <span className="event-card-badge">
                {event.event_subcategory || "Event"}
              </span>
            </div>

            <div className="event-card-body">
              <h3>{event.name}</h3>

              <p>{formatDate(event.event_date)}</p>

              <p>
                {event.venue || "Venue TBC"}
                {event.city ? ` · ${event.city}` : ""}
              </p>

              <div className="event-card-footer">
                <span>
                  <strong>{available}</strong> available
                </span>

                <span>
                  {startingPrice
                    ? `From €${startingPrice.toFixed(2)}`
                    : "Price TBC"}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default EventInventoryCards;