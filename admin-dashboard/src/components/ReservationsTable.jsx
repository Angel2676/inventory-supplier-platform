import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function ReservationsTable() {
  const { user } = useAuth();

  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  async function loadReservations() {
    try {
      const response = await api.get("/api/reservations");

      setReservations(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento prenotazioni");
    }
  }

  useEffect(() => {
    loadReservations();

    const interval = setInterval(() => {
      loadReservations();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="section">
      <h2>Reservations</h2>

      {error && <div className="error">{error}</div>}

      <table className="tickets-table">
        <thead>
          <tr>
            <th>Codice</th>

            {isSuperAdmin && <th>User ID</th>}
            {isSuperAdmin && <th>Company</th>}
            {isSuperAdmin && <th>Email</th>}

            <th>Ticket</th>
            <th>Categoria</th>
            <th>Quantità</th>
            <th>Prezzo</th>
            <th>Stato</th>
            <th>Creata</th>
            <th>Confermata</th>
          </tr>
        </thead>

        <tbody>
          {reservations.map((reservation) => (
            <tr key={reservation.reservation_code}>
              <td>{reservation.reservation_code}</td>

              {isSuperAdmin && <td>{reservation.user_id || "-"}</td>}

              {isSuperAdmin && (
                <td>{reservation.company_name || "Storica / API key"}</td>
              )}

              {isSuperAdmin && <td>{reservation.email || "-"}</td>}

              <td>{reservation.supplier_ticket_id}</td>
              <td>{reservation.category}</td>
              <td>{reservation.quantity}</td>
              <td>€ {reservation.price}</td>

              <td>
                <span className={`status-badge status-${reservation.status}`}>
                  {reservation.status}
                </span>
              </td>

              <td>
                {reservation.created_at
                  ? new Date(reservation.created_at).toLocaleString()
                  : "-"}
              </td>

              <td>
                {reservation.confirmed_at
                  ? new Date(reservation.confirmed_at).toLocaleString()
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReservationsTable;