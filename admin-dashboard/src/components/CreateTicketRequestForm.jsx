import { useState } from "react";
import api from "../api";

function CreateTicketRequestForm({ onCreated }) {
  const [form, setForm] = useState({
    ticket_id: "",
    quantity: 1,
    notes: ""
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm({
      ...form,
      [field]: value
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage("");
    setError("");

    try {
      await api.post("/api/ticket-requests", {
        ticket_id: Number(form.ticket_id),
        quantity: Number(form.quantity),
        notes: form.notes
      });

      setMessage("Richiesta inviata correttamente. In attesa di approvazione.");

      setForm({
        ticket_id: "",
        quantity: 1,
        notes: ""
      });

      if (onCreated) {
        onCreated();
      }
    } catch (err) {
      console.error(err);
      const data = err.response?.data;

if (data?.effectively_available !== undefined) {
  setError(
    `${data.error}. Disponibili: ${data.available_quantity}, già in pending: ${data.pending_quantity}, realmente disponibili: ${data.effectively_available}`
  );
} else {
  setError(data?.error || "Errore invio richiesta ticket");
}
    }
  }

  return (
    <div className="section form-card">
      <h2>Richiedi tickets</h2>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit} className="ticket-form">
        <input
          type="number"
          placeholder="Ticket ID"
          value={form.ticket_id}
          onChange={(e) => updateField("ticket_id", e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Quantità"
          value={form.quantity}
          onChange={(e) => updateField("quantity", e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Note richiesta"
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
        />

        <button className="btn btn-save" type="submit">
          Invia richiesta
        </button>
      </form>
    </div>
  );
}

export default CreateTicketRequestForm;