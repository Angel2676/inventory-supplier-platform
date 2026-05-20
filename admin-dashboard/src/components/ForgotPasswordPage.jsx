import { useState } from "react";
import api from "../api";

function ForgotPasswordPage({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/forgot-password", {
        email
      });

      setMessage(
        response.data?.message ||
          "Se l'email è registrata, riceverai un link per reimpostare la password."
      );

      setEmail("");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Errore richiesta reset password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Password dimenticata</h1>

        <p>
          Inserisci la tua email. Se l’account esiste, riceverai
          un link per reimpostare la password.
        </p>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="La tua email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button className="btn btn-save" type="submit" disabled={loading}>
            {loading ? "Invio in corso..." : "Invia link reset"}
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={onBackToLogin}
          >
            Torna al login
          </button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;