import { useEffect, useState } from "react";
import api from "../api";

function SystemActivityTimeline() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  async function loadLogs() {
    try {
      const response = await api.get("/api/audit-logs");
      setLogs(response.data.slice(0, 30));
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento timeline attività");
    }
  }

  useEffect(() => {
    loadLogs();

    const interval = setInterval(loadLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="section form-card">
      <h2>System Activity Timeline</h2>

      {error && <div className="error">{error}</div>}

      <div className="timeline-list">
        {logs.map((log) => (
          <div key={log.id} className="timeline-item">
            <div className="timeline-dot" />

            <div>
              <strong>{log.action}</strong>
              <p>
                {log.resource_type} #{log.resource_id}
              </p>
              <small>
                {new Date(log.created_at).toLocaleString()}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SystemActivityTimeline;