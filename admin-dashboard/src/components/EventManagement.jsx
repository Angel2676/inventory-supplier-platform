import { useEffect, useState } from "react";
import api from "../api";

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
      "Altro calcio"
    ]
  },
  {
    value: "concert",
    label: "Concerti",
    subcategories: [
      "Concerti italiani",
      "Concerti internazionali"
    ]
  },
  {
    value: "formula_1",
    label: "Formula 1",
    subcategories: [
      "Grand Prix"
    ]
  }
];

function EventManagement() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const emptyForm = {
    name: "",
    event_date: "",
    venue: "",
    city: "",
    country: "",
    event_type: "football",
    event_subcategory: "Serie A",
    status: "active",
    visibility: "public",
    notes: ""
  };

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  function getTypeConfig(type) {
    return EVENT_TYPES.find((item) => item.value === type);
  }

  function getTypeLabel(type) {
    return getTypeConfig(type)?.label || "-";
  }

  function getSubcategories(type) {
    return getTypeConfig(type)?.subcategories || [];
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  async function loadEvents() {
    try {
      const response = await api.get("/api/events");
      setEvents(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento eventi");
    }
  }

  useEffect(() => {
    loadEvents();

    const interval = setInterval(loadEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  function updateForm(field, value) {
    if (field === "event_type") {
      const firstSubcategory = getSubcategories(value)[0] || "";

      setForm({
        ...form,
        event_type: value,
        event_subcategory: firstSubcategory
      });

      return;
    }

    setForm({ ...form, [field]: value });
  }

  function updateEditForm(field, value) {
    if (field === "event_type") {
      const firstSubcategory = getSubcategories(value)[0] || "";

      setEditForm({
        ...editForm,
        event_type: value,
        event_subcategory: firstSubcategory
      });

      return;
    }

    setEditForm({ ...editForm, [field]: value });
  }

  async function createEvent(e) {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      await api.post("/api/events", {
        ...form,
        event_date: form.event_date || null,
        event_type: form.event_type || null,
        event_subcategory: form.event_subcategory || null
      });

      setMessage("Evento creato correttamente");
      setForm(emptyForm);

      await loadEvents();
    } catch (err) {
      console.error(err);
      setError("Errore creazione evento");
    }
  }

  function startEdit(event) {
    const eventType = event.event_type || "football";
    const subcategories = getSubcategories(eventType);

    setEditingId(event.id);

    setEditForm({
      name: event.name || "",
      event_date: event.event_date
        ? event.event_date.slice(0, 16)
        : "",
      venue: event.venue || "",
      city: event.city || "",
      country: event.country || "",
      event_type: eventType,
      event_subcategory:
        event.event_subcategory ||
        subcategories[0] ||
        "",
      status: event.status || "active",
      visibility: event.visibility || "public",
      notes: event.notes || ""
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(eventId) {
    setMessage("");
    setError("");

    try {
      await api.patch(`/api/events/${eventId}`, {
        ...editForm,
        event_date: editForm.event_date || null,
        event_type: editForm.event_type || null,
        event_subcategory: editForm.event_subcategory || null
      });

      setEditingId(null);
      setMessage("Evento aggiornato correttamente");

      await loadEvents();
    } catch (err) {
      console.error(err);
      setError("Errore aggiornamento evento");
    }
  }

  async function deleteEvent(eventId) {
    if (!window.confirm("Vuoi eliminare questo evento?")) return;

    setMessage("");
    setError("");

    try {
      await api.delete(`/api/events/${eventId}`);
      setMessage("Evento eliminato correttamente");
      await loadEvents();
    } catch (err) {
      console.error(err);
      setError("Errore eliminazione evento");
    }
  }

  const availableSubcategoryFilters = typeFilter
    ? getSubcategories(typeFilter)
    : [];

  const filteredEvents = events.filter((event) => {
    const text = `
      ${event.name || ""}
      ${event.venue || ""}
      ${event.city || ""}
      ${event.country || ""}
      ${event.status || ""}
      ${event.visibility || ""}
      ${event.event_type || ""}
      ${event.event_subcategory || ""}
    `.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesType = typeFilter
      ? event.event_type === typeFilter
      : true;

    const matchesSubcategory = subcategoryFilter
      ? event.event_subcategory === subcategoryFilter
      : true;

    return matchesSearch && matchesType && matchesSubcategory;
  });

  return (
    <div className="section">
      <h2>Event Management</h2>

      <p style={{ marginBottom: "18px", color: "#64748b" }}>
        Gestisci macro aree, sottocategorie, venue, date e visibilità degli eventi.
      </p>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={createEvent} className="ticket-form">
        <input
          type="text"
          placeholder="Nome evento"
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
          required
        />

        <select
          value={form.event_type}
          onChange={(e) => updateForm("event_type", e.target.value)}
          required
        >
          {EVENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <select
          value={form.event_subcategory}
          onChange={(e) =>
            updateForm("event_subcategory", e.target.value)
          }
        >
          {getSubcategories(form.event_type).map((subcategory) => (
            <option key={subcategory} value={subcategory}>
              {subcategory}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={form.event_date}
          onChange={(e) => updateForm("event_date", e.target.value)}
        />

        <input
          type="text"
          placeholder="Venue / Stadium"
          value={form.venue}
          onChange={(e) => updateForm("venue", e.target.value)}
        />

        <input
          type="text"
          placeholder="Città"
          value={form.city}
          onChange={(e) => updateForm("city", e.target.value)}
        />

        <input
          type="text"
          placeholder="Paese"
          value={form.country}
          onChange={(e) => updateForm("country", e.target.value)}
        />

        <select
          value={form.status}
          onChange={(e) => updateForm("status", e.target.value)}
        >
          <option value="active">active</option>
          <option value="sold_out">sold_out</option>
          <option value="cancelled">cancelled</option>
        </select>

        <select
          value={form.visibility}
          onChange={(e) => updateForm("visibility", e.target.value)}
        >
          <option value="public">public</option>
          <option value="private">private</option>
        </select>

        <input
          type="text"
          placeholder="Note"
          value={form.notes}
          onChange={(e) => updateForm("notes", e.target.value)}
        />

        <button className="btn btn-save" type="submit">
          Crea evento
        </button>
      </form>

      <div className="filters-bar">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setSubcategoryFilter("");
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
          onChange={(e) => setSubcategoryFilter(e.target.value)}
          disabled={!typeFilter}
        >
          <option value="">Tutte le sottocategorie</option>

          {availableSubcategoryFilters.map((subcategory) => (
            <option key={subcategory} value={subcategory}>
              {subcategory}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Cerca evento, città, venue, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Macro area</th>
            <th>Sottocategoria</th>
            <th>Evento</th>
            <th>Data</th>
            <th>Venue</th>
            <th>Città</th>
            <th>Paese</th>
            <th>Status</th>
            <th>Visibility</th>
            <th>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {filteredEvents.map((event) => (
            <tr key={event.id}>
              <td>{event.id}</td>

              <td>
                {editingId === event.id ? (
                  <select
                    value={editForm.event_type}
                    onChange={(e) =>
                      updateEditForm("event_type", e.target.value)
                    }
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  getTypeLabel(event.event_type)
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <select
                    value={editForm.event_subcategory}
                    onChange={(e) =>
                      updateEditForm(
                        "event_subcategory",
                        e.target.value
                      )
                    }
                  >
                    {getSubcategories(editForm.event_type).map(
                      (subcategory) => (
                        <option key={subcategory} value={subcategory}>
                          {subcategory}
                        </option>
                      )
                    )}
                  </select>
                ) : (
                  event.event_subcategory || "-"
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <input
                    className="table-input"
                    value={editForm.name}
                    onChange={(e) =>
                      updateEditForm("name", e.target.value)
                    }
                  />
                ) : (
                  event.name
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <input
                    className="table-input"
                    type="datetime-local"
                    value={editForm.event_date}
                    onChange={(e) =>
                      updateEditForm("event_date", e.target.value)
                    }
                  />
                ) : (
                  formatDate(event.event_date)
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <input
                    className="table-input"
                    value={editForm.venue}
                    onChange={(e) =>
                      updateEditForm("venue", e.target.value)
                    }
                  />
                ) : (
                  event.venue || "-"
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <input
                    className="table-input"
                    value={editForm.city}
                    onChange={(e) =>
                      updateEditForm("city", e.target.value)
                    }
                  />
                ) : (
                  event.city || "-"
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <input
                    className="table-input"
                    value={editForm.country}
                    onChange={(e) =>
                      updateEditForm("country", e.target.value)
                    }
                  />
                ) : (
                  event.country || "-"
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      updateEditForm("status", e.target.value)
                    }
                  >
                    <option value="active">active</option>
                    <option value="sold_out">sold_out</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                ) : (
                  <span className={`status-badge status-${event.status}`}>
                    {event.status}
                  </span>
                )}
              </td>

              <td>
                {editingId === event.id ? (
                  <select
                    value={editForm.visibility}
                    onChange={(e) =>
                      updateEditForm("visibility", e.target.value)
                    }
                  >
                    <option value="public">public</option>
                    <option value="private">private</option>
                  </select>
                ) : (
                  event.visibility
                )}
              </td>

              <td className="actions-cell">
                {editingId === event.id ? (
                  <>
                    <button
                      className="btn btn-save"
                      onClick={() => saveEdit(event.id)}
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
                      onClick={() => startEdit(event)}
                    >
                      Modifica
                    </button>

                    <button
                      className="btn btn-delete"
                      onClick={() => deleteEvent(event.id)}
                    >
                      Elimina
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EventManagement;