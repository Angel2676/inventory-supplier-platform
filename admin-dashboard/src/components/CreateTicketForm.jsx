import { useEffect, useState } from "react";
import api from "../api";

function CreateTicketForm({ onCreated }) {
  const [events, setEvents] = useState([]);

  const [form, setForm] = useState({
    event_id: "",
    supplier_ticket_id: "",
    category: "",
    block: "",
    row_name: "",
    seat_from: "",
    seat_to: "",
    quantity: 1,
    price: 0,
    currency: "EUR"
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadEvents() {
    try {
      const response = await api.get("/api/events");

      setEvents(response.data);

      if (response.data.length > 0 && !form.event_id) {
        setForm((prev) => ({
          ...prev,
          event_id: response.data[0].id
        }));
      }

      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento eventi");
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  function updateField(field, value) {
    setForm({
      ...form,
      [field]: value
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setMessage("");

    try {
      await api.post("/api/tickets", {
        ...form,
        event_id: Number(form.event_id),
        quantity: Number(form.quantity),
        price: Number(form.price)
      });

      setMessage("Ticket creato correttamente");

      setForm({
        event_id: events.length > 0 ? events[0].id : "",
        supplier_ticket_id: "",
        category: "",
        block: "",
        row_name: "",
        seat_from: "",
        seat_to: "",
        quantity: 1,
        price: 0,
        currency: "EUR"
      });

      if (onCreated) {
        onCreated();
      }
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error || "Errore creazione ticket"
      );
    }
  }

  return (
    <div className="section form-card">
      <h2>Crea nuovo ticket</h2>

      <button
        className="btn btn-secondary"
        type="button"
        onClick={loadEvents}
      >
        Aggiorna lista eventi
      </button>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit} className="ticket-form">
        <select
          value={form.event_id}
          onChange={(e) =>
            updateField("event_id", e.target.value)
          }
          required
        >
          <option value="">Seleziona evento</option>

          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} — ID {event.id}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Supplier Ticket ID"
          value={form.supplier_ticket_id}
          onChange={(e) =>
            updateField("supplier_ticket_id", e.target.value)
          }
          required
        />

        <input
          type="text"
          placeholder="Categoria"
          value={form.category}
          onChange={(e) =>
            updateField("category", e.target.value)
          }
          required
        />

        <input
          type="text"
          placeholder="Blocco"
          value={form.block}
          onChange={(e) =>
            updateField("block", e.target.value)
          }
        />

        <input
          type="text"
          placeholder="Fila"
          value={form.row_name}
          onChange={(e) =>
            updateField("row_name", e.target.value)
          }
        />

        <input
          type="text"
          placeholder="Seat from"
          value={form.seat_from}
          onChange={(e) =>
            updateField("seat_from", e.target.value)
          }
        />

        <input
          type="text"
          placeholder="Seat to"
          value={form.seat_to}
          onChange={(e) =>
            updateField("seat_to", e.target.value)
          }
        />

        <input
          type="number"
          placeholder="Quantità"
          value={form.quantity}
          onChange={(e) =>
            updateField("quantity", e.target.value)
          }
          required
        />

        <input
          type="number"
          placeholder="Prezzo"
          value={form.price}
          onChange={(e) =>
            updateField("price", e.target.value)
          }
          required
        />

        <input
          type="text"
          placeholder="Valuta"
          value={form.currency}
          onChange={(e) =>
            updateField("currency", e.target.value)
          }
        />

        <button className="btn btn-save" type="submit">
          Crea ticket
        </button>
      </form>
    </div>
  );
}

export default CreateTicketForm;