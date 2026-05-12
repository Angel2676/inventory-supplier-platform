import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function TicketRequestsTable() {
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [error, setError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  async function loadRequests() {
    try {
      const response = await api.get("/api/ticket-requests");
      setRequests(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento richieste tickets");
    }
  }

  async function approveRequest(requestId) {
    try {
      await api.patch(`/api/ticket-requests/${requestId}/approve`);
      await loadRequests();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Errore approvazione richiesta");
    }
  }

  async function rejectRequest(requestId) {
    const rejection_reason = window.prompt(
      "Motivo del rifiuto:",
      "Richiesta non approvata"
    );

    if (rejection_reason === null) return;

    try {
      await api.patch(`/api/ticket-requests/${requestId}/reject`, {
        rejection_reason
      });

      await loadRequests();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Errore rifiuto richiesta");
    }
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  }

  function getTotalPrice(request) {
    return (
      Number(request.price || 0) *
      Number(request.quantity || 0)
    ).toFixed(2);
  }

  function getEventTime(value) {
    if (!value) return Number.MAX_SAFE_INTEGER;
    return new Date(value).getTime();
  }

  const filteredRequests = requests
    .filter((request) => {
      const text = `
        ${request.id || ""}
        ${request.event_name || ""}
        ${request.event_date || ""}
        ${request.supplier_ticket_id || ""}
        ${request.category || ""}
        ${request.block || ""}
        ${request.quantity || ""}
        ${request.status || ""}
        ${request.notes || ""}
        ${request.company_name || ""}
        ${request.contact_name || ""}
        ${request.email || ""}
      `.toLowerCase();

      return text.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const dateA = getEventTime(a.event_date);
      const dateB = getEventTime(b.event_date);

      if (sortDirection === "asc") {
        return dateA - dateB;
      }

      return dateB - dateA;
    });

  useEffect(() => {
    loadRequests();

    const interval = setInterval(() => {
      loadRequests();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="section">
      <h2>{isSuperAdmin ? "Ticket Requests" : "Le mie richieste"}</h2>

      {error && <div className="error">{error}</div>}

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Cerca per evento, ticket, categoria, status, partner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={sortDirection}
          onChange={(e) => setSortDirection(e.target.value)}
        >
          <option value="asc">Data evento: più vicina</option>
          <option value="desc">Data evento: più lontana</option>
        </select>
      </div>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>ID</th>

            {isSuperAdmin && <th>Company</th>}
            {isSuperAdmin && <th>Contact</th>}
            {isSuperAdmin && <th>Email</th>}

            <th>Evento</th>
            <th>Data evento</th>
            <th>Ticket</th>
            <th>Categoria</th>
            <th>Blocco</th>
            <th>Quantità</th>
            <th>Prezzo unitario</th>
            <th>Totale</th>
            <th>Status</th>
            <th>Note</th>

            {isSuperAdmin && <th>Azioni</th>}
          </tr>
        </thead>

        <tbody>
          {filteredRequests.map((request) => (
            <tr key={request.id}>
              <td>{request.id}</td>

              {isSuperAdmin && <td>{request.company_name || "-"}</td>}
              {isSuperAdmin && <td>{request.contact_name || "-"}</td>}
              {isSuperAdmin && <td>{request.email || "-"}</td>}

              <td>{request.event_name || "-"}</td>

              <td>{formatDate(request.event_date)}</td>

              <td>{request.supplier_ticket_id}</td>

              <td>{request.category}</td>

              <td>{request.block || "-"}</td>

              <td>{request.quantity}</td>

              <td>€ {Number(request.price || 0).toFixed(2)}</td>

              <td>
                <strong>€ {getTotalPrice(request)}</strong>
              </td>

              <td>
                <span className={`status-badge status-${request.status}`}>
                  {request.status}
                </span>
              </td>

              <td>{request.notes || "-"}</td>

              {isSuperAdmin && (
                <td>
                  {request.status === "pending" ? (
                    <>
                      <button
                        className="btn btn-save"
                        onClick={() => approveRequest(request.id)}
                      >
                        Approva
                      </button>

                      <button
                        className="btn btn-delete"
                        onClick={() => rejectRequest(request.id)}
                      >
                        Rifiuta
                      </button>
                    </>
                  ) : (
                    "-"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TicketRequestsTable;