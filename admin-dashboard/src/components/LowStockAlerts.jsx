import { useEffect, useState } from "react";
import api from "../api";

function LowStockAlerts() {
  const [alerts, setAlerts] = useState([]);

  async function loadAlerts() {
    try {
      const response = await api.get("/api/inventory-alerts/low-stock");
      setAlerts(response.data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadAlerts();

    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="section form-card">
      <h2>Low Stock Alerts</h2>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Ticket</th>
            <th>Categoria</th>
            <th>Disponibili</th>
            <th>Soglia</th>
            <th>Prezzo</th>
          </tr>
        </thead>

        <tbody>
          {alerts.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.event_name}</td>
              <td>{ticket.supplier_ticket_id}</td>
              <td>{ticket.category}</td>
              <td>{ticket.available_quantity}</td>
              <td>{ticket.low_stock_threshold}</td>
              <td>€ {ticket.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LowStockAlerts;