import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceOrdersTable() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      const response = await api.get("/api/marketplace/orders");

      setOrders(response.data || []);
      setError("");
    } catch (err) {
      console.error(err);

      setError("Errore caricamento marketplace orders");
    }
  }

  useEffect(() => {
    loadOrders();

    const interval = setInterval(loadOrders, 10000);

    return () => clearInterval(interval);
  }, []);

  function exportOrdersToCsv() {
    if (!orders.length) return;

    const headers = [
      "ID",
      "Marketplace",
      "Order ID",
      "Evento",
      "Data evento",
      "Categoria",
      "Block",
      "Qty",
      "Total",
      "Currency",
      "Order Status",
      "Fulfillment",
      "Created"
    ];

    const rows = orders.map((order) => [
      order.id,
      order.marketplace,
      order.marketplace_order_id || "",
      order.event_name || "",
      order.event_date || "",
      order.category || "",
      order.block || "",
      order.quantity,
      order.total_amount || "",
      order.currency || "EUR",
      order.order_status || "",
      order.fulfillment_status || "",
      order.created_at || ""
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.setAttribute("download", "marketplace_orders.csv");

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="section">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px"
        }}
      >
        <h2>Marketplace Orders</h2>

        <button
          className="btn btn-secondary"
          onClick={exportOrdersToCsv}
          disabled={false}
        >
          Export CSV
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {orders.length === 0 ? (
        <p>Nessuna vendita marketplace registrata.</p>
      ) : (
        <table className="tickets-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Marketplace</th>
              <th>Order ID</th>
              <th>Evento</th>
              <th>Data evento</th>
              <th>Categoria</th>
              <th>Block</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Currency</th>
              <th>Order Status</th>
              <th>Fulfillment</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.id}</td>

                <td>{order.marketplace}</td>

                <td>{order.marketplace_order_id || "-"}</td>

                <td>{order.event_name || "-"}</td>

                <td>
                  {order.event_date
                    ? new Date(order.event_date).toLocaleString()
                    : "-"}
                </td>

                <td>{order.category || "-"}</td>

                <td>{order.block || "-"}</td>

                <td>{order.quantity}</td>

                <td>
                  {order.total_amount
                    ? Number(order.total_amount).toFixed(2)
                    : "-"}
                </td>

                <td>{order.currency || "EUR"}</td>

                <td>{order.order_status || "-"}</td>

                <td>{order.fulfillment_status || "-"}</td>

                <td>
                  {order.created_at
                    ? new Date(order.created_at).toLocaleString()
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

export default MarketplaceOrdersTable;
