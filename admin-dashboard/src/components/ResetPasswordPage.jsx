import { useState } from "react";
import api from "../api";

function ResetPasswordPage({ token, onBackToLogin }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage("");
    setError("");

    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri");
      return;
    }

    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(`/api/auth/reset-password/${token}`, {
        password
      });

      setMessage(
        response.data?.message ||
          "Password aggiornata correttamente. Ora puoi effettuare il login."
      );

      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Errore aggiornamento password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Nuova password</h1>

        <p>Inserisci una nuova password per il tuo account.</p>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Nuova password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Conferma nuova password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button className="btn btn-save" type="submit" disabled={loading}>
            {loading ? "Aggiornamento..." : "Aggiorna password"}
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

export default ResetPasswordPage;