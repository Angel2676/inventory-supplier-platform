import { useState } from "react";
import api from "../api";

function RegisterPage({ onBackToLogin }) {
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    password: ""
  });

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function updateField(field, value) {
    setForm({
      ...form,
      [field]: value
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setSuccess("");
    setError("");

    try {
      await api.post("/api/auth/register", form);

      setSuccess(
        "Grazie per la registrazione. Il tuo account è stato creato correttamente e sarà verificato dal nostro team. A breve potrai accedere ai nostri servizi."
      );

      setForm({
        company_name: "",
        contact_name: "",
        email: "",
        password: ""
      });
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error ||
          "Errore durante la registrazione"
      );
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Registrazione Partner</h1>

        <p>
          Crea il tuo account partner. Dopo la registrazione,
          il nostro team verificherà la richiesta.
        </p>

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nome azienda"
            value={form.company_name}
            onChange={(e) =>
              updateField("company_name", e.target.value)
            }
            required
          />

          <input
            type="text"
            placeholder="Nome referente"
            value={form.contact_name}
            onChange={(e) =>
              updateField("contact_name", e.target.value)
            }
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              updateField("email", e.target.value)
            }
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) =>
              updateField("password", e.target.value)
            }
            required
          />

          <button className="btn btn-save" type="submit">
            Registrati
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

export default RegisterPage;