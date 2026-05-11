import { useState } from "react";
import api from "../api";

function RegisterPage({ onBackToLogin }) {
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    password: ""
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
      await api.post("/api/auth/register", form);

      setMessage(
        "Registrazione ricevuta. Il tuo account è in attesa di approvazione da parte del super admin."
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
        err.response?.data?.error || "Errore durante la registrazione"
      );
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Registrazione Partner</h1>

        <p>Crea un account partner in attesa di approvazione.</p>

        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}

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