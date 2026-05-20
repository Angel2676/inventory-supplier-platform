import { useEffect, useState } from "react";
import api from "../api";

function BusinessAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    try {
      const response = await api.get("/api/analytics/overview");
      setData(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento analytics");
    }
  }

  useEffect(() => {
    loadAnalytics();

    const interval = setInterval(loadAnalytics, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  return (
    <div className="section">
      <h2>Business Analytics</h2>

      {error && <div className="error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <h2>€ {data.stock.available_stock_value}</h2>
          <p>Valore stock disponibile</p>
        </div>

        <div className="stat-card">
          <h2>€ {data.stock.total_stock_value}</h2>
          <p>Valore stock totale</p>
        </div>

        <div className="stat-card">
          <h2>€ {data.confirmed.confirmed_value}</h2>
          <p>Valore confermato</p>
        </div>

        <div className="stat-card">
          <h2>{data.requests.approval_rate || 0}%</h2>
          <p>Approval rate richieste</p>
        </div>

        <div className="stat-card alert-card">
          <h2>{data.low_stock.low_stock_count}</h2>
          <p>Tickets low stock</p>
        </div>
      </div>

      <h3>Top Events</h3>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Quantità totale</th>
            <th>Disponibili</th>
            <th>Valore disponibile</th>
          </tr>
        </thead>

        <tbody>
          {data.top_events.map((event) => (
            <tr key={event.id}>
              <td>{event.name}</td>
              <td>{event.total_quantity}</td>
              <td>{event.available_quantity}</td>
              <td>€ {event.available_value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Top Partners</h3>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>Partner</th>
            <th>Email</th>
            <th>Richieste</th>
            <th>Approvate</th>
          </tr>
        </thead>

        <tbody>
          {data.top_partners.map((partner) => (
            <tr key={partner.id}>
              <td>{partner.company_name || "-"}</td>
              <td>{partner.email}</td>
              <td>{partner.requests_count}</td>
              <td>{partner.approved_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BusinessAnalytics;