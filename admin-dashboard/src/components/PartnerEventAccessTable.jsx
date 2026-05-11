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

  async function assignAllEvents() {
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
          onClick={assignAllEvents}
        >
          Assegna tutti gli eventi
        </button>
      </form>

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

              <td>
                {access.company_name || access.contact_name || "-"}
              </td>

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