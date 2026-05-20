import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function AdminPendingAlert() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const isSuperAdmin = user?.role === "super_admin";

  async function loadPending() {
    try {
      const response = await api.get("/api/ticket-requests");
      const pending = response.data.filter((r) => r.status === "pending");
      setPendingCount(pending.length);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (!isSuperAdmin) return;

    loadPending();

    const interval = setInterval(() => {
      loadPending();
    }, 10000);

    return () => clearInterval(interval);
  }, [isSuperAdmin]);

  if (!isSuperAdmin || pendingCount === 0) return null;

  return (
    <div className="admin-alert">
      <strong>{pendingCount}</strong> richieste ticket in attesa di approvazione.
    </div>
  );
}

export default AdminPendingAlert;