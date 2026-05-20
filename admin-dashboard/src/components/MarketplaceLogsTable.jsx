import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceLogsTable() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  async function loadLogs() {
    try {
      const response = await api.get("/api/marketplace/logs");
      setLogs(response.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento marketplace logs");
    }
  }

  useEffect(() => {
    loadLogs();

    const interval = setInterval(loadLogs, 10000);

    return () => clearInterval(interval);
  }, []);

  function getStatusBadgeClass(status) {
    switch (status) {
      case "synced":
      case "published":
      case "processed":
        return "status-badge status-available";

      case "pending":
      case "needs_sync":
        return "status-badge status-pending";

      case "failed":
        return "status-badge status-sold";

      default:
        return "status-badge";
    }
  }

  return (
    <div className="section">
      <h2>Marketplace Logs</h2>

      {error && <div className="error">{error}</div>}

      {logs.length === 0 ? (
        <p>Nessun log marketplace disponibile.</p>
      ) : (
        <table className="tickets-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Marketplace</th>
              <th>Action</th>
              <th>Status</th>
              <th>Event</th>
              <th>Supplier Ticket</th>
              <th>Error</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.id}</td>

                <td>{log.marketplace || "-"}</td>

                <td>{log.action || "-"}</td>

                <td>
                  <span className={getStatusBadgeClass(log.status)}>
                    {(log.status || "-").toUpperCase()}
                  </span>
                </td>

                <td>{log.event_name || "-"}</td>

                <td>{log.supplier_ticket_id || "-"}</td>

                <td>{log.error_message || "-"}</td>

                <td>
                  {log.created_at
                    ? new Date(log.created_at).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MarketplaceLogsTable;
