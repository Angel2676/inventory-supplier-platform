import { useState } from "react";
import api from "../api";

function CreateReservationForm({ onCreated }) {
  const [form, setForm] = useState({
    ticket_id: "",
    quantity: 1
  });

  const [createdReservation, setCreatedReservation] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm({
      ...form,
      [field]: value
    });
  }

  async function createReservation(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setCreatedReservation(null);

    try {
      const response = await api.post("/api/reservations", {
        ticket_id: Number(form.ticket_id),
        quantity: Number(form.quantity)
      });

      setCreatedReservation(response.data.reservation);
      setMessage("Prenotazione creata correttamente");

      setForm({
        ticket_id: "",
        quantity: 1
      });

      if (onCreated) {
        onCreated();
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Errore creazione prenotazione"
      );
    }
  }

  async function confirmReservation() {
    if (!createdReservation?.reservation_code) return;

    try {
      setError("");
      setMessage("");

      await api.post(
        `/api/reservations/${createdReservation.reservation_code}/confirm`
      );

      setMessage("Prenotazione confermata correttamente");
      setCreatedReservation(null);

      if (onCreated) {
        onCreated();
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Errore conferma prenotazione"
      );
    }
  }

  return (
    <div className="section form-card">
      <h2>Crea prenotazione</h2>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={createReservation} className="ticket-form">
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

        <button className="btn btn-save" type="submit">
          Crea prenotazione
        </button>
      </form>

      {createdReservation && (
        <div className="reservation-box">
          <p>
            <strong>Codice:</strong>{" "}
            {createdReservation.reservation_code}
          </p>
          <p>
            <strong>Ticket ID:</strong> {createdReservation.ticket_id}
          </p>
          <p>
            <strong>Quantità:</strong> {createdReservation.quantity}
          </p>
          <p>
            <strong>Scadenza:</strong>{" "}
            {new Date(createdReservation.expires_at).toLocaleString()}
          </p>

          <button className="btn btn-edit" onClick={confirmReservation}>
            Conferma prenotazione
          </button>
        </div>
      )}
    </div>
  );
}

export default CreateReservationForm;