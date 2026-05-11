import { useEffect, useState } from "react";
import api from "../api";

function EventManagement() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    event_date: "",
    venue: "",
    city: "",
    country: "",
    status: "active",
    visibility: "public",
    notes: ""
  });

  const [editForm, setEditForm] = useState({ ...form });

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
    setForm({ ...form, [field]: value });
  }

  function updateEditForm(field, value) {
    setEditForm({ ...editForm, [field]: value });
  }

  async function createEvent(e) {
    e.preventDefault();

    try {
      await api.post("/api/events", {
        ...form,
        event_date: form.event_date || null
      });

      setMessage("Evento creato correttamente");
      setForm({
        name: "",
        event_date: "",
        venue: "",
        city: "",
        country: "",
        status: "active",
        visibility: "public",
        notes: ""
      });

      await loadEvents();
    } catch (err) {
      console.error(err);
      setError("Errore creazione evento");
    }
  }

  function startEdit(event) {
    setEditingId(event.id);

    setEditForm({
      name: event.name || "",
      event_date: event.event_date
        ? event.event_date.slice(0, 16)
        : "",
      venue: event.venue || "",
      city: event.city || "",
      country: event.country || "",
      status: event.status || "active",
      visibility: event.visibility || "public",
      notes: event.notes || ""
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(eventId) {
    try {
      await api.patch(`/api/events/${eventId}`, {
        ...editForm,
        event_date: editForm.event_date || null
      });

      setEditingId(null);
      await loadEvents();
    } catch (err) {
      console.error(err);
      setError("Errore aggiornamento evento");
    }
  }

  async function deleteEvent(eventId) {
    if (!window.confirm("Vuoi eliminare questo evento?")) return;

    try {
      await api.delete(`/api/events/${eventId}`);
      await loadEvents();
    } catch (err) {
      console.error(err);
      setError("Errore eliminazione evento");
    }
  }

  const filteredEvents = events.filter((event) => {
    const text = `
      ${event.name || ""}
      ${event.venue || ""}
      ${event.city || ""}
      ${event.country || ""}
      ${event.status || ""}
      ${event.visibility || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="section">
      <h2>Event Management</h2>

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
                ) : event.event_date ? (
                  new Date(event.event_date).toLocaleString()
                ) : (
                  "-"
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

              <td>
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