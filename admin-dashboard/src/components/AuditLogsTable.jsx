import { useEffect, useState } from "react";
import api from "../api";

function AuditLogsTable() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    action: "",
    resource_type: "",
    limit: 20
  });

  async function loadLogs() {
    try {
      const params = new URLSearchParams();

      if (filters.action) {
        params.append("action", filters.action);
      }

      if (filters.resource_type) {
        params.append("resource_type", filters.resource_type);
      }

      params.append("limit", filters.limit);

      const response = await api.get(
        `/api/audit-logs?${params.toString()}`
      );

      setLogs(response.data);
      setError("");

    } catch (err) {
      console.error(err);
      setError("Errore caricamento audit logs");
    }
  }

  useEffect(() => {
    loadLogs();
  }, [filters]);

  return (
    <div className="section">
      <h2>Audit Logs</h2>

      <div className="filters-bar">
        <select
          value={filters.action}
          onChange={(e) =>
            setFilters({
              ...filters,
              action: e.target.value
            })
          }
        >
          <option value="">Tutte le azioni</option>
          <option value="CREATE_TICKET">CREATE_TICKET</option>
          <option value="UPDATE_TICKET">UPDATE_TICKET</option>
          <option value="DELETE_TICKET">DELETE_TICKET</option>
          <option value="CREATE_RESERVATION">CREATE_RESERVATION</option>
          <option value="CONFIRM_RESERVATION">
            CONFIRM_RESERVATION
          </option>
        </select>

        <select
          value={filters.resource_type}
          onChange={(e) =>
            setFilters({
              ...filters,
              resource_type: e.target.value
            })
          }
        >
          <option value="">Tutte le risorse</option>
          <option value="ticket">ticket</option>
          <option value="reservation">reservation</option>
        </select>

        <select
          value={filters.limit}
          onChange={(e) =>
            setFilters({
              ...filters,
              limit: e.target.value
            })
          }
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      <table className="tickets-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Azione</th>
            <th>Risorsa</th>
            <th>Resource ID</th>
            <th>Cliente</th>
            <th>Data</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.id}</td>
              <td>{log.action}</td>
              <td>{log.resource_type}</td>
              <td>{log.resource_id}</td>
              <td>{log.client_name}</td>
              <td>{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AuditLogsTable;