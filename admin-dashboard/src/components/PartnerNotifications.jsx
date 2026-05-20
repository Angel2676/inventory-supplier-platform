import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function PartnerNotifications() {
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  const isPartner = user?.role !== "super_admin";

  async function loadRequests() {
    try {
      const response = await api.get("/api/ticket-requests");
      setRequests(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento notifiche");
    }
  }

  useEffect(() => {
    if (!isPartner) return;

    loadRequests();

    const interval = setInterval(() => {
      loadRequests();
    }, 10000);

    return () => clearInterval(interval);
  }, [isPartner]);

  if (!isPartner) return null;

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <div className="section form-card">
      <h2>Le tue richieste</h2>

      {error && <div className="error">{error}</div>}

      <div className="notification-grid">
        <div className="notification-card pending">
          <h3>{pendingCount}</h3>
          <p>In attesa</p>
        </div>

        <div className="notification-card approved">
          <h3>{approvedCount}</h3>
          <p>Approvate</p>
        </div>

        <div className="notification-card rejected">
          <h3>{rejectedCount}</h3>
          <p>Rifiutate</p>
        </div>
      </div>
    </div>
  );
}

export default PartnerNotifications;