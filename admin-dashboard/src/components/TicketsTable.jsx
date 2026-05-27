import { useEffect, useState } from "react";
import api from "../api";
import { useTranslation } from "react-i18next";
import EventInventoryCards from "./EventInventoryCards";
import EventCategoryBanners from "./EventCategoryBanners";
import EventDetailModal from "./EventDetailModal";
import EmptyState from "./EmptyState";
import SuccessModal from "./SuccessModal";
import TeamSelectionCards from "./TeamSelectionCards";

const EVENT_TYPES = [
  {
    value: "football",
    label: "Calcio",
    subcategories: [
      "Serie A",
      "Premier League",
      "La Liga",
      "Bundesliga",
      "Ligue 1",
      "Champions League",
      "Europa League",
      "Conference League",
      "Nazionali",
      "Altro calcio",
    ],
  },
  {
    value: "concert",
    label: "Concerti",
    subcategories: ["Concerti italiani", "Concerti internazionali"],
  },
  {
    value: "formula_1",
    label: "Formula 1",
    subcategories: ["Grand Prix"],
  },
];

function TicketsTable({ canEdit = true, marketplaceMode = false }) {
  const { t } = useTranslation();

  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);

  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const [editingId, setEditingId] = useState(null);

  const [requestQuantities, setRequestQuantities] = useState({});
  const [requestNotes, setRequestNotes] = useState({});

  const [successModal, setSuccessModal] = useState(null);
  const [publishingTicketId, setPublishingTicketId] = useState(null);
  const [readinessByTicketId, setReadinessByTicketId] = useState({});
  const [error, setError] = useState("");

  const [editForm, setEditForm] = useState({
    price: "",
    marketplace_price: "",
    available_quantity: "",
    low_stock_threshold: "",
    min_price: "",
    undercut_amount: "0.01",
    auto_reprice_enabled: false,
  });

  async function loadTickets() {
    try {
      const response = await api.get("/api/tickets");
      setTickets(response.data.tickets || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento tickets");
    }
  }

  async function loadEvents() {
    try {
      const response = await api.get("/api/events");
      setEvents(response.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadTickets();
    loadEvents();

    const interval = setInterval(() => {
      loadTickets();
      loadEvents();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  function getEvent(eventId) {
    return events.find((item) => Number(item.id) === Number(eventId));
  }

  function getEventName(eventId) {
    const event = getEvent(eventId);
    return event ? event.name : `Evento ID ${eventId}`;
  }

  function getEventDate(eventId) {
    return getEvent(eventId)?.event_date || null;
  }

  function getEventType(eventId) {
    return getEvent(eventId)?.event_type || "";
  }

  function getEventSubcategory(eventId) {
    return getEvent(eventId)?.event_subcategory || "";
  }

  function getEventTeam(eventId) {
    return getEvent(eventId)?.team_name || "";
  }

  function getSubcategories(type) {
    return EVENT_TYPES.find((item) => item.value === type)?.subcategories || [];
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  function getEventTime(eventId) {
    const eventDate = getEventDate(eventId);
    if (!eventDate) return Number.MAX_SAFE_INTEGER;
    return new Date(eventDate).getTime();
  }

  function startEdit(ticket) {
    setEditingId(ticket.id);

    setEditForm({
      price: ticket.partner_price || ticket.price || "",
      marketplace_price: ticket.marketplace_price || "",
      available_quantity: ticket.available_quantity || "",
      low_stock_threshold: ticket.low_stock_threshold || 2,
      min_price: ticket.min_price || "",
      undercut_amount: ticket.undercut_amount || "0.01",
      auto_reprice_enabled: Boolean(ticket.auto_reprice_enabled),
    });
  }

  function cancelEdit() {
    setEditingId(null);

    setEditForm({
      price: "",
      marketplace_price: "",
      available_quantity: "",
      low_stock_threshold: "",
      min_price: "",
      undercut_amount: "0.01",
      auto_reprice_enabled: false,
    });
  }

  async function saveEdit(ticketId) {
    try {
      await api.patch(`/api/tickets/${ticketId}`, {
        price: Number(editForm.price),
        partner_price: Number(editForm.price),
        marketplace_price: editForm.marketplace_price
          ? Number(editForm.marketplace_price)
          : null,
        available_quantity: Number(editForm.available_quantity),
        low_stock_threshold: Number(editForm.low_stock_threshold),
      });

      if (editForm.min_price !== "" || editForm.auto_reprice_enabled === true) {
        await api.patch(`/api/tickets/${ticketId}/pricing`, {
          min_price: editForm.min_price ? Number(editForm.min_price) : null,

          auto_reprice_enabled: Boolean(editForm.auto_reprice_enabled),

          undercut_amount: Number(editForm.undercut_amount || 0.01),
        });
      }

      setEditingId(null);

      await loadTickets();
    } catch (err) {
      console.error(err);

      setError(err.response?.data?.error || "Errore aggiornamento ticket");
    }
  }

  async function deleteTicket(ticketId) {
    if (!window.confirm("Eliminare questo ticket?")) return;

    try {
      await api.delete(`/api/tickets/${ticketId}`);
      await loadTickets();
    } catch (err) {
      console.error(err);
      setError("Errore eliminazione ticket");
    }
  }

  function updateRequestQuantity(ticketId, value) {
    setRequestQuantities({
      ...requestQuantities,
      [ticketId]: value,
    });
  }

  function updateRequestNote(ticketId, value) {
    setRequestNotes({
      ...requestNotes,
      [ticketId]: value,
    });
  }

  async function publishToGigsberg(ticket) {
    try {
      setPublishingTicketId(ticket.id);

      await api.post("/api/marketplace/publish", {
        ticket_id: ticket.id,
        marketplace: "gigsberg",
      });

      setSuccessModal({
        title: "Publish avviato",
        message:
          "Il ticket è stato aggiunto alla coda publish Gigsberg. Appena saranno disponibili le API credentials complete sarà sincronizzato automaticamente.",
      });

      await loadTickets();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Errore publish Gigsberg");
    } finally {
      setPublishingTicketId(null);
    }
  }

  async function publishToTicombo(ticket) {
    try {
      setPublishingTicketId(ticket.id);

      await api.post("/api/marketplace/publish", {
        ticket_id: ticket.id,
        marketplace: "ticombo",
      });

      setSuccessModal({
        title: "Publish completato",
        message:
          "Il ticket è stato pubblicato su Ticombo ed è ora sincronizzato nei Marketplace Listings.",
      });

      await loadTickets();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Errore publish Ticombo");
    } finally {
      setPublishingTicketId(null);
    }
  }

  async function publishToSportEvents365(ticket) {
    try {
      setPublishingTicketId(ticket.id);

      await api.post("/api/marketplace/publish", {
        ticket_id: ticket.id,
        marketplace: "sportevents365",
      });

      setSuccessModal({
        title: "Publish avviato",
        message:
          "Il ticket è stato inviato alla coda publish SportEvents365. Il sistema userà il mapping evento e le Supplier API per completare la pubblicazione.",
      });

      await loadTickets();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Errore publish SportEvents365");
    } finally {
      setPublishingTicketId(null);
    }
  }

  async function requestTicket(ticket) {
    setError("");

    const quantity = Number(requestQuantities[ticket.id] || 1);

    if (!quantity || quantity <= 0) {
      setError("Inserisci una quantità valida");
      return;
    }

    if (quantity > Number(ticket.available_quantity)) {
      setError("Quantità richiesta superiore alla disponibilità");
      return;
    }

    try {
      await api.post("/api/ticket-requests", {
        ticket_id: ticket.id,
        quantity,
        notes:
          requestNotes[ticket.id] ||
          `Richiesta inviata per ${getEventName(ticket.event_id)}`,
      });

      setSuccessModal({
        title: "Richiesta inviata",
        message:
          "La tua richiesta tickets è stata inviata correttamente. Riceverai aggiornamenti appena sarà gestita dal team SportManiaTravel.",
      });

      setRequestQuantities({
        ...requestQuantities,
        [ticket.id]: 1,
      });

      setRequestNotes({
        ...requestNotes,
        [ticket.id]: "",
      });

      await loadTickets();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Errore invio richiesta ticket");
    }
  }

  const availableSubcategories = typeFilter ? getSubcategories(typeFilter) : [];

  const filteredEventsForTeams = events.filter((event) => {
    const matchesType = typeFilter ? event.event_type === typeFilter : true;

    const matchesSubcategory = subcategoryFilter
      ? event.event_subcategory === subcategoryFilter
      : true;

    const hasTickets = tickets.some(
      (ticket) => Number(ticket.event_id) === Number(event.id),
    );

    return matchesType && matchesSubcategory && hasTickets;
  });

  const filteredEventsForCards = events.filter((event) => {
    const matchesType = typeFilter ? event.event_type === typeFilter : true;

    const matchesSubcategory = subcategoryFilter
      ? event.event_subcategory === subcategoryFilter
      : true;

    const matchesTeam = teamFilter ? event.team_name === teamFilter : false;

    const matchesEvent = eventFilter
      ? Number(event.id) === Number(eventFilter)
      : true;

    const hasTickets = tickets.some(
      (ticket) => Number(ticket.event_id) === Number(event.id),
    );

    return (
      matchesType &&
      matchesSubcategory &&
      matchesTeam &&
      matchesEvent &&
      hasTickets
    );
  });

  const filteredTickets = tickets
    .filter((ticket) => {
      const eventName = getEventName(ticket.event_id);

      const text = `
        ${eventName || ""}
        ${getEventTeam(ticket.event_id) || ""}
        ${ticket.category || ""}
        ${ticket.block || ""}
        ${ticket.status || ""}
      `.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());

      const matchesEvent = eventFilter
        ? Number(ticket.event_id) === Number(eventFilter)
        : true;

      const matchesType = typeFilter
        ? getEventType(ticket.event_id) === typeFilter
        : true;

      const matchesSubcategory = subcategoryFilter
        ? getEventSubcategory(ticket.event_id) === subcategoryFilter
        : true;

      const matchesTeam = teamFilter
        ? getEventTeam(ticket.event_id) === teamFilter
        : true;

      return (
        matchesSearch &&
        matchesEvent &&
        matchesType &&
        matchesSubcategory &&
        matchesTeam
      );
    })
    .sort((a, b) => {
      const dateA = getEventTime(a.event_id);
      const dateB = getEventTime(b.event_id);

      if (sortDirection === "asc") {
        return dateA - dateB;
      }

      return dateB - dateA;
    });

  async function loadPublishReadiness(ticketId) {
    try {
      const response = await api.get(
        `/api/marketplace/publish-readiness/${ticketId}`,
      );

      setReadinessByTicketId((prev) => ({
        ...prev,
        [ticketId]: response.data,
      }));

      const data = response.data;

      let checksText = `Publish Readiness per ticket #${data.ticket_id}\n\n`;

      Object.entries(data.checks || {}).forEach(([marketplace, check]) => {
        checksText += `${marketplace.toUpperCase()}: ${
          check.ready ? "READY" : "NOT READY"
        }\n`;

        if (check.errors?.length) {
          checksText += `Errori:\n`;

          check.errors.forEach((err) => {
            checksText += `- ${err}\n`;
          });
        }

        if (check.warnings?.length) {
          checksText += `Warnings:\n`;

          check.warnings.forEach((warn) => {
            checksText += `- ${warn}\n`;
          });
        }

        checksText += `\n`;
      });

      setSuccessModal({
        title: "Publish Readiness",
        message: checksText,
      });
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error || "Errore controllo publish readiness",
      );
    }
  }

  return (
    <div className="section">
      <h2>{canEdit ? t("ticketsInventory") : t("inventory")}</h2>

      {error && <div className="error">{error}</div>}

      {successModal && (
        <SuccessModal
          title={successModal.title}
          message={successModal.message}
          onClose={() => setSuccessModal(null)}
        />
      )}

      {!canEdit && (
        <>
          <EventCategoryBanners
            selectedType={typeFilter}
            onSelectType={(type) => {
              setTypeFilter(type);
              setSubcategoryFilter("");
              setTeamFilter("");
              setEventFilter("");
            }}
          />

          <TeamSelectionCards
            events={filteredEventsForTeams}
            tickets={tickets}
            selectedTeam={teamFilter}
            onSelectTeam={(teamName) => {
              setTeamFilter(teamName);
              setEventFilter("");
            }}
          />

          {teamFilter && (
            <EventInventoryCards
              events={filteredEventsForCards}
              tickets={tickets}
              onSelectEvent={(eventId) => {
                const event = events.find(
                  (item) => Number(item.id) === Number(eventId),
                );

                setSelectedEvent(event);
              }}
            />
          )}
        </>
      )}

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          tickets={tickets}
          onClose={() => setSelectedEvent(null)}
          onViewTickets={() => {
            setEventFilter(String(selectedEvent.id));
            setSelectedEvent(null);

            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            });
          }}
        />
      )}

      {canEdit && (
        <div className="filters-bar">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setSubcategoryFilter("");
              setTeamFilter("");
              setEventFilter("");
            }}
          >
            <option value="">Tutte le macro aree</option>

            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <select
            value={subcategoryFilter}
            onChange={(e) => {
              setSubcategoryFilter(e.target.value);
              setTeamFilter("");
              setEventFilter("");
            }}
            disabled={!typeFilter}
          >
            <option value="">Tutte le sottocategorie</option>

            {availableSubcategories.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>

          <select
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              setEventFilter("");
            }}
          >
            <option value="">Tutti i team</option>

            {Array.from(
              new Set(
                filteredEventsForTeams
                  .map((event) => event.team_name)
                  .filter(Boolean),
              ),
            )
              .sort()
              .map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
          </select>

          <select
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value)}
          >
            <option value="asc">Data evento: più vicina</option>
            <option value="desc">Data evento: più lontana</option>
          </select>

          <input
            type="text"
            placeholder="Cerca ticket, evento, squadra, categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {!teamFilter && !canEdit && (
        <EmptyState
          title="Select a team, artist or category"
          message="Use the selector above to choose a team, artist or category and browse available events."
          showWhatsApp={false}
        />
      )}

      {teamFilter && filteredTickets.length === 0 && (
        <EmptyState
          title="No tickets available"
          message="No tickets match your current filters. Try changing team, artist, event or contact SportManiaTravel."
        />
      )}

      {(canEdit || teamFilter) && filteredTickets.length > 0 && (
        <table className="tickets-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Team / Artist</th>
              <th>Evento</th>
              <th>Data evento</th>
              <th>Categoria</th>
              <th>Block</th>
              <th>Available</th>
              <th>Partner Price</th>

              {canEdit && <th>Marketplace Price</th>}
              {canEdit && <th>Min Price</th>}
              {canEdit && <th>Auto Reprice</th>}
              {canEdit && <th>Undercut</th>}
              {canEdit && <th>Last Market</th>}
              {canEdit && <th>Last Suggested</th>}

              {!canEdit && <th>Qty</th>}
              {!canEdit && <th>Note</th>}
              {!canEdit && <th>Totale</th>}

              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredTickets.map((ticket) => {
              const requestQuantity = Number(requestQuantities[ticket.id] || 1);

              const partnerPrice = Number(
                ticket.partner_price || ticket.price || 0,
              );

              const marketplacePrice = Number(
                ticket.marketplace_price || ticket.price || 0,
              );

              const totalPrice = (partnerPrice * requestQuantity).toFixed(2);

              return (
                <tr key={ticket.id}>
                  <td>{ticket.id}</td>

                  <td>{getEventTeam(ticket.event_id) || "-"}</td>

                  <td>{getEventName(ticket.event_id)}</td>

                  <td>{formatDate(getEventDate(ticket.event_id))}</td>

                  <td>{ticket.category}</td>

                  <td>{ticket.block || "-"}</td>

                  <td>
                    {editingId === ticket.id ? (
                      <input
                        className="table-input"
                        type="number"
                        value={editForm.available_quantity}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            available_quantity: e.target.value,
                          })
                        }
                      />
                    ) : (
                      ticket.available_quantity
                    )}
                  </td>

                  <td>
                    {editingId === ticket.id ? (
                      <input
                        className="table-input"
                        type="number"
                        step="0.01"
                        value={editForm.price}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            price: e.target.value,
                          })
                        }
                      />
                    ) : (
                      `€ ${partnerPrice.toFixed(2)}`
                    )}
                  </td>

                  {canEdit && (
                    <td>
                      {editingId === ticket.id ? (
                        <input
                          className="table-input"
                          type="number"
                          step="0.01"
                          value={editForm.marketplace_price}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              marketplace_price: e.target.value,
                            })
                          }
                        />
                      ) : (
                        `€ ${marketplacePrice.toFixed(2)}`
                      )}
                    </td>
                  )}

                  {canEdit && (
                    <td>
                      {editingId === ticket.id ? (
                        <input
                          className="table-input"
                          type="number"
                          step="0.01"
                          value={editForm.min_price}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              min_price: e.target.value,
                            })
                          }
                        />
                      ) : ticket.min_price ? (
                        `€ ${Number(ticket.min_price).toFixed(2)}`
                      ) : (
                        "-"
                      )}
                    </td>
                  )}

                  {canEdit && (
                    <td>
                      {editingId === ticket.id ? (
                        <input
                          type="checkbox"
                          checked={editForm.auto_reprice_enabled}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              auto_reprice_enabled: e.target.checked,
                            })
                          }
                        />
                      ) : ticket.auto_reprice_enabled ? (
                        "ON"
                      ) : (
                        "OFF"
                      )}
                    </td>
                  )}

                  {canEdit && (
                    <td>
                      {editingId === ticket.id ? (
                        <input
                          className="table-input"
                          type="number"
                          step="0.01"
                          value={editForm.undercut_amount}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              undercut_amount: e.target.value,
                            })
                          }
                        />
                      ) : (
                        `€ ${Number(ticket.undercut_amount || 0.01).toFixed(2)}`
                      )}
                    </td>
                  )}

                  {canEdit && (
                    <td>
                      {ticket.last_market_price
                        ? `€ ${Number(ticket.last_market_price).toFixed(2)}`
                        : "-"}
                    </td>
                  )}

                  {canEdit && (
                    <td>
                      {ticket.last_suggested_price
                        ? `€ ${Number(ticket.last_suggested_price).toFixed(2)}`
                        : "-"}
                    </td>
                  )}

                  {!canEdit && (
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="1"
                        max={ticket.available_quantity}
                        value={requestQuantities[ticket.id] || 1}
                        onChange={(e) =>
                          updateRequestQuantity(ticket.id, e.target.value)
                        }
                      />
                    </td>
                  )}

                  {!canEdit && (
                    <td>
                      <input
                        className="table-input"
                        type="text"
                        placeholder="Note per admin..."
                        value={requestNotes[ticket.id] || ""}
                        onChange={(e) =>
                          updateRequestNote(ticket.id, e.target.value)
                        }
                      />
                    </td>
                  )}

                  {!canEdit && (
                    <td>
                      <strong>€ {totalPrice}</strong>
                    </td>
                  )}

                  <td>
                    <span className={`status-badge status-${ticket.status}`}>
                      {ticket.status}
                    </span>
                  </td>

                  <td className="actions-cell">
                    {canEdit ? (
                      editingId === ticket.id ? (
                        <>
                          <button
                            className="btn btn-save"
                            onClick={() => saveEdit(ticket.id)}
                          >
                            Salva
                          </button>

                          <button
                            className="btn btn-secondary"
                            onClick={cancelEdit}
                          >
                            Annulla
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-edit"
                            onClick={() => startEdit(ticket)}
                          >
                            Modifica
                          </button>

                          <button
                            className="btn btn-delete"
                            onClick={() => deleteTicket(ticket.id)}
                          >
                            Elimina
                          </button>

                          {marketplaceMode && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => loadPublishReadiness(ticket.id)}
                            >
                              Check Publish Readiness
                            </button>
                          )}

                          {marketplaceMode && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => publishToGigsberg(ticket)}
                              disabled={publishingTicketId === ticket.id}
                            >
                              {publishingTicketId === ticket.id
                                ? "Publishing..."
                                : "Publish Gigsberg"}
                            </button>
                          )}

                          {marketplaceMode && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => publishToTicombo(ticket)}
                              disabled={publishingTicketId === ticket.id}
                            >
                              {publishingTicketId === ticket.id
                                ? "Publishing..."
                                : "Publish Ticombo"}
                            </button>
                          )}

                          {marketplaceMode && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => publishToSportEvents365(ticket)}
                              disabled={publishingTicketId === ticket.id}
                            >
                              {publishingTicketId === ticket.id
                                ? "Publishing..."
                                : "Publish SportEvents365"}
                            </button>
                          )}
                        </>
                      )
                    ) : (
                      <button
                        className="btn btn-save"
                        onClick={() => requestTicket(ticket)}
                        disabled={
                          Number(ticket.available_quantity) <= 0 ||
                          ticket.status !== "available"
                        }
                      >
                        {t("requestTickets")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TicketsTable;
