function EventDetailModal({ event, tickets = [], onClose, onViewTickets }) {
  if (!event) return null;

  const eventTickets = tickets.filter(
    (ticket) => Number(ticket.event_id) === Number(event.id)
  );

  const availableQuantity = eventTickets.reduce(
    (sum, ticket) => sum + Number(ticket.available_quantity || 0),
    0
  );

  const prices = eventTickets
    .map((ticket) => Number(ticket.final_price || ticket.price || 0))
    .filter((price) => price > 0);

  const startingPrice = prices.length > 0 ? Math.min(...prices) : null;

  function formatDate(value) {
    if (!value) return "Date TBC";
    return new Date(value).toLocaleString();
  }

  const whatsappText = encodeURIComponent(
    `Ciao, vorrei informazioni sull'evento ${event.name}`
  );

  return (
    <div className="event-modal-overlay">
      <div className="event-modal-premium">
        <button className="event-modal-close" type="button" onClick={onClose}>
          ×
        </button>

        <div
          className="event-modal-premium-hero"
          style={{
            backgroundImage: event.image_url
              ? `linear-gradient(180deg, rgba(15,23,42,0.15), rgba(15,23,42,0.88)), url(${event.image_url})`
              : "linear-gradient(135deg, #0f172a, #2563eb)"
          }}
        >
          {event.logo_url && (
            <img className="event-modal-premium-logo" src={event.logo_url} alt={event.name} />
          )}

          <div className="event-modal-premium-title">
            <span>{event.event_subcategory || event.event_type || "Event"}</span>
            <h2>{event.name}</h2>
            <p>{formatDate(event.event_date)}</p>
          </div>
        </div>

        <div className="event-modal-premium-body">
          <div className="event-modal-location-card">
            <strong>{event.venue || "Venue TBC"}</strong>
            <span>
              {event.city || "-"}
              {event.country ? ` · ${event.country}` : ""}
            </span>
          </div>

          <div className="event-modal-stats-premium">
            <div>
              <strong>{availableQuantity}</strong>
              <span>Available tickets</span>
            </div>

            <div>
              <strong>{startingPrice ? `€${startingPrice.toFixed(2)}` : "TBC"}</strong>
              <span>Starting price</span>
            </div>

            <div>
              <strong>{eventTickets.length}</strong>
              <span>Ticket options</span>
            </div>
          </div>

          <div className="event-modal-actions-premium">
            <button className="btn btn-save" type="button" onClick={onViewTickets}>
              Vedi tickets disponibili
            </button>

            <a
              className="event-whatsapp-action"
              href={`https://wa.me/393392986384?text=${whatsappText}`}
              target="_blank"
              rel="noreferrer"
            >
              Chat WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventDetailModal;