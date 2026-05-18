import { useEffect, useState } from "react";
import api from "../api";

function PartnerEventAccessTable() {
  const [accesses, setAccesses] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);

  const [form, setForm] = useState({
    user_id: "",
    event_id: ""
  });

  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [eventSearch, setEventSearch] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const [accessRes, usersRes, eventsRes] = await Promise.all([
        api.get("/api/partner-event-access"),
        api.get("/api/users"),
        api.get("/api/events")
      ]);

      setAccesses(accessRes.data);
      setUsers(usersRes.data.filter((user) => user.role !== "super_admin"));
      setEvents(eventsRes.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento accessi partner/eventi");
    }
  }

  async function assignAccess(e) {
    e.preventDefault();

    if (!form.user_id || !form.event_id) {
      setError("Seleziona partner ed evento");
      return;
    }

    try {
      await api.post("/api/partner-event-access", {
        user_id: Number(form.user_id),
        event_id: Number(form.event_id)
      });

      setMessage("Accesso evento assegnato correttamente");
      setError("");
      setForm({
        user_id: form.user_id,
        event_id: ""
      });

      await loadData();
    } catch (err) {
      console.error(err);
      setError("Errore assegnazione accesso evento");
    }
  }

  async function assignAllEventsToSelectedPartner() {
    if (!form.user_id) {
      setError("Seleziona prima un partner");
      return;
    }

    try {
      for (const event of events) {
        await api.post("/api/partner-event-access", {
          user_id: Number(form.user_id),
          event_id: Number(event.id)
        });
      }

      setMessage("Tutti gli eventi sono stati assegnati al partner selezionato");
      setError("");

      await loadData();
    } catch (err) {
      console.error(err);
      setError("Errore assegnazione di tutti gli eventi");
    }
  }

  async function assignSelectedEventsToAllPartners() {
    if (selectedEventIds.length === 0) {
      setError("Seleziona almeno un evento da assegnare a tutti i partner");
      return;
    }

    if (
      !window.confirm(
        `Vuoi assegnare ${selectedEventIds.length} evento/i a tutti i partner/client?`
      )
    ) {
      return;
    }

    try {
      const response = await api.post("/api/partner-event-access/assign-all", {
        event_ids: selectedEventIds.map(Number)
      });

      setMessage(
        `Eventi assegnati a tutti i partner/client. Nuovi accessi creati: ${
          response.data.inserted_count || 0
        }`
      );
      setError("");
      setSelectedEventIds([]);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Errore assegnazione eventi a tutti i partner"
      );
    }
  }

  async function removeAccess(accessId) {
    if (!window.confirm("Rimuovere questo accesso evento?")) {
      return;
    }

    try {
      await api.delete(`/api/partner-event-access/${accessId}`);

      setMessage("Accesso evento rimosso correttamente");
      setError("");

      await loadData();
    } catch (err) {
      console.error(err);
      setError("Errore rimozione accesso evento");
    }
  }

  function toggleEventSelection(eventId) {
    const id = Number(eventId);

    setSelectedEventIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  }

  function selectAllFilteredEvents() {
    const ids = filteredEvents.map((event) => Number(event.id));
    setSelectedEventIds(ids);
  }

  function clearSelectedEvents() {
    setSelectedEventIds([]);
  }

  const filteredEvents = events.filter((event) => {
    const text = `
      ${event.id || ""}
      ${event.name || ""}
      ${event.event_type || ""}
      ${event.event_subcategory || ""}
      ${event.team_name || ""}
      ${event.city || ""}
      ${event.venue || ""}
    `.toLowerCase();

    return text.includes(eventSearch.toLowerCase());
  });

  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="section">
      <h2>Partner Event Access</h2>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={assignAccess} className="filters-bar">
        <select
          value={form.user_id}
          onChange={(e) =>
            setForm({
              ...form,
              user_id: e.target.value
            })
          }
          required
        >
          <option value="">Seleziona partner</option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.company_name || user.contact_name || user.email} —{" "}
              {user.email} ({user.role})
            </option>
          ))}
        </select>

        <select
          value={form.event_id}
          onChange={(e) =>
            setForm({
              ...form,
              event_id: e.target.value
            })
          }
        >
          <option value="">Seleziona evento</option>

          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} — ID {event.id}
            </option>
          ))}
        </select>

        <button className="btn btn-save" type="submit">
          Assegna accesso
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={assignAllEventsToSelectedPartner}
        >
          Assegna tutti gli eventi al partner
        </button>
      </form>

      <div className="section" style={{ marginTop: "22px" }}>
        <h3>Assegna eventi a tutti i partner</h3>

        <p style={{ color: "#64748b", marginBottom: "14px" }}>
          Seleziona uno o più eventi e assegnali automaticamente a tutti i
          partner/client registrati.
        </p>

        <div className="filters-bar">
          <input
            type="text"
            placeholder="Cerca evento, squadra, città, competizione..."
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
          />

          <button
            className="btn btn-secondary"
            type="button"
            onClick={selectAllFilteredEvents}
          >
            Seleziona eventi filtrati
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={clearSelectedEvents}
          >
            Deseleziona
          </button>

          <button
            className="btn btn-save"
            type="button"
            onClick={assignSelectedEventsToAllPartners}
          >
            Assegna selezionati a tutti i partner
          </button>
        </div>

        <p style={{ color: "#475569", marginBottom: "12px" }}>
          Eventi selezionati: <strong>{selectedEventIds.length}</strong>
        </p>

        <table className="tickets-table">
          <thead>
            <tr>
              <th>Seleziona</th>
              <th>ID</th>
              <th>Evento</th>
              <th>Macro area</th>
              <th>Competizione</th>
              <th>Team / Artist</th>
              <th>Città</th>
            </tr>
          </thead>

          <tbody>
            {filteredEvents.map((event) => (
              <tr key={event.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedEventIds.includes(Number(event.id))}
                    onChange={() => toggleEventSelection(event.id)}
                  />
                </td>

                <td>{event.id}</td>
                <td>{event.name}</td>
                <td>{event.event_type || "-"}</td>
                <td>{event.event_subcategory || "-"}</td>
                <td>{event.team_name || "-"}</td>
                <td>{event.city || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Partner</th>
            <th>Email</th>
            <th>Ruolo</th>
            <th>Evento</th>
            <th>Event ID</th>
            <th>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {accesses.map((access) => (
            <tr key={access.id}>
              <td>{access.id}</td>

              <td>{access.company_name || access.contact_name || "-"}</td>

              <td>{access.email}</td>

              <td>{access.role || "-"}</td>

              <td>{access.event_name}</td>

              <td>{access.event_id}</td>

              <td>
                <button
                  className="btn btn-delete"
                  onClick={() => removeAccess(access.id)}
                >
                  Rimuovi
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PartnerEventAccessTable;