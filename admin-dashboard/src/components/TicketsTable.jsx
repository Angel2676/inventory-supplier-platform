import { useEffect, useState } from "react";
import api from "../api";

function TicketsTable({ canEdit = true }) {
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [editForm, setEditForm] = useState({
    price: "",
    available_quantity: "",
    low_stock_threshold: ""
  });

  async function loadTickets() {
    try {
      const response = await api.get("/api/tickets");
      setTickets(response.data.tickets || []);
    } catch (err) {
      console.error("Errore caricamento tickets:", err);
    }
  }

  useEffect(() => {
    loadTickets();

    const interval = setInterval(loadTickets, 10000);
    return () => clearInterval(interval);
  }, []);

  function startEdit(ticket) {
    setEditingId(ticket.id);

    setEditForm({
      price: ticket.price,
      available_quantity: ticket.available_quantity,
      low_stock_threshold: ticket.low_stock_threshold || 2
    });
  }

  function cancelEdit() {
    setEditingId(null);

    setEditForm({
      price: "",
      available_quantity: "",
      low_stock_threshold: ""
    });
  }

  async function saveEdit(ticketId) {
    try {
      await api.patch(`/api/tickets/${ticketId}`, {
        price: Number(editForm.price),
        available_quantity: Number(editForm.available_quantity),
        low_stock_threshold: Number(editForm.low_stock_threshold)
      });

      setEditingId(null);
      await loadTickets();
    } catch (err) {
      console.error("Errore aggiornamento ticket:", err);
    }
  }

  async function deleteTicket(ticketId) {
    if (!window.confirm("Eliminare questo ticket?")) return;

    try {
      await api.delete(`/api/tickets/${ticketId}`);
      await loadTickets();
    } catch (err) {
      console.error("Errore eliminazione ticket:", err);
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    const text = `
      ${ticket.id || ""}
      ${ticket.event_id || ""}
      ${ticket.supplier_ticket_id || ""}
      ${ticket.category || ""}
      ${ticket.block || ""}
      ${ticket.row_name || ""}
      ${ticket.seat_from || ""}
      ${ticket.seat_to || ""}
      ${ticket.status || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="section">
      <h2>Tickets Inventory</h2>

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Cerca ticket, categoria, blocco, evento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Event</th>
            <th>Supplier Ticket</th>
            <th>Category</th>
            <th>Block</th>
            <th>Row</th>
            <th>Seats</th>
            <th>Quantity</th>
            <th>Available</th>
            <th>Low Stock</th>
            <th>Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredTickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>{ticket.id}</td>
              <td>{ticket.event_id}</td>
              <td>{ticket.supplier_ticket_id}</td>
              <td>{ticket.category}</td>
              <td>{ticket.block || "-"}</td>
              <td>{ticket.row_name || "-"}</td>
              <td>
                {ticket.seat_from || "-"} - {ticket.seat_to || "-"}
              </td>
              <td>{ticket.quantity}</td>

              <td>
                {editingId === ticket.id ? (
                  <input
                    className="table-input"
                    type="number"
                    value={editForm.available_quantity}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        available_quantity: e.target.value
                      })
                    }
                  />
                ) : (
                  ticket.available_quantity
                )}
              </td>

              <td>
                {editingId === ticket.id ? (
                  <input
                    className="table-input"
                    type="number"
                    value={editForm.low_stock_threshold}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        low_stock_threshold: e.target.value
                      })
                    }
                  />
                ) : (
                  ticket.low_stock_threshold
                )}
              </td>

              <td>
                {editingId === ticket.id ? (
                  <input
                    className="table-input"
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        price: e.target.value
                      })
                    }
                  />
                ) : (
                  `€ ${ticket.final_price || ticket.price}`
                )}
              </td>

              <td>
                <span className={`status-badge status-${ticket.status}`}>
                  {ticket.status}
                </span>
              </td>

              <td className="actions-cell">
                {canEdit ? (
                  editingId === ticket.id ? (
                    <>
                      <button
                        className="btn btn-save"
                        onClick={() => saveEdit(ticket.id)}
                      >
                        Salva
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={cancelEdit}
                      >
                        Annulla
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-edit"
                        onClick={() => startEdit(ticket)}
                      >
                        Modifica
                      </button>

                      <button
                        className="btn btn-delete"
                        onClick={() => deleteTicket(ticket.id)}
                      >
                        Elimina
                      </button>
                    </>
                  )
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TicketsTable;