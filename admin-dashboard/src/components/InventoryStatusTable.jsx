import { useEffect, useState } from "react";
import api from "../api";

function getHealthStatus(item) {
  if (Number(item.effective_available) < 0) {
    return { label: "OVERBOOK RISK", className: "status-rejected" };
  }

  if (Number(item.effective_available) === 0) {
    return { label: "SOLD OUT", className: "status-sold" };
  }

  if (Number(item.effective_available) <= Number(item.low_stock_threshold || 0)) {
    return { label: "LOW STOCK", className: "status-pending" };
  }

  return { label: "OK", className: "status-approved" };
}

function InventoryStatusTable() {
  const [items, setItems] = useState([]);
  const [healthFilter, setHealthFilter] = useState("");
  const [error, setError] = useState("");

  async function loadInventoryStatus() {
    try {
      const response = await api.get("/api/inventory-status");
      setItems(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento inventory status");
    }
  }

  useEffect(() => {
    loadInventoryStatus();

    const interval = setInterval(loadInventoryStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = items.filter((item) => {
    const health = getHealthStatus(item);
    if (!healthFilter) return true;
    return health.label === healthFilter;
  });

  return (
    <div className="section">
      <h2>Inventory Intelligence</h2>

      <div className="filters-bar">
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          <option value="OK">OK</option>
          <option value="LOW STOCK">LOW STOCK</option>
          <option value="SOLD OUT">SOLD OUT</option>
          <option value="OVERBOOK RISK">OVERBOOK RISK</option>
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      <table className="tickets-table">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Ticket</th>
            <th>Categoria</th>
            <th>Stock</th>
            <th>Disponibili DB</th>
            <th>Pending</th>
            <th>Reserved</th>
            <th>Confirmed</th>
            <th>Disponibili reali</th>
            <th>Utilizzo</th>
            <th>Health</th>
          </tr>
        </thead>

        <tbody>
          {filteredItems.map((item) => {
            const health = getHealthStatus(item);

            return (
              <tr key={item.id}>
                <td>{item.event_name}</td>
                <td>{item.supplier_ticket_id}</td>
                <td>{item.category}</td>
                <td>{item.original_quantity}</td>
                <td>{item.available_quantity}</td>
                <td>{item.pending_quantity}</td>
                <td>{item.reserved_quantity}</td>
                <td>{item.confirmed_quantity}</td>
                <td>
                  <strong>{item.effective_available}</strong>
                </td>
                <td>{item.utilization_percent || 0}%</td>
                <td>
                  <span className={`status-badge ${health.className}`}>
                    {health.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default InventoryStatusTable;