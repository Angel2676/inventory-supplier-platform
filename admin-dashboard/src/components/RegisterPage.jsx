import { useState } from "react";
import api from "../api";

function RegisterPage({ onBackToLogin }) {
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    password: "",
    phone: "",
    website: "",
    company_address: "",
    company_city: "",
    company_country: "",
    vat_number: ""
  });

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const response = await api.post(
        "/api/auth/register",
        form
      );

      setSuccess(
        response.data?.message ||
          "Grazie per la registrazione. A breve potrai accedere ai nostri servizi dopo la verifica del nostro team."
      );

      setForm({
        company_name: "",
        contact_name: "",
        email: "",
        password: "",
        phone: "",
        website: "",
        company_address: "",
        company_city: "",
        company_country: "",
        vat_number: ""
      });
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error ||
          "Errore durante la registrazione"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Registrazione Partner</h1>

        <p>
          Crea il tuo account partner. Dopo la
          registrazione il nostro team verificherà la
          richiesta.
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
              updateField(
                "company_name",
                e.target.value
              )
            }
            required
          />

          <input
            type="text"
            placeholder="Nome referente"
            value={form.contact_name}
            onChange={(e) =>
              updateField(
                "contact_name",
                e.target.value
              )
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
              updateField(
                "password",
                e.target.value
              )
            }
            required
          />

          <input
            type="text"
            placeholder="Numero di telefono"
            value={form.phone}
            onChange={(e) =>
              updateField("phone", e.target.value)
            }
          />

          <input
            type="text"
            placeholder="Sito web (opzionale)"
            value={form.website}
            onChange={(e) =>
              updateField(
                "website",
                e.target.value
              )
            }
          />

          <input
            type="text"
            placeholder="Indirizzo società"
            value={form.company_address}
            onChange={(e) =>
              updateField(
                "company_address",
                e.target.value
              )
            }
          />

          <input
            type="text"
            placeholder="Città"
            value={form.company_city}
            onChange={(e) =>
              updateField(
                "company_city",
                e.target.value
              )
            }
          />

          <input
            type="text"
            placeholder="Nazione"
            value={form.company_country}
            onChange={(e) =>
              updateField(
                "company_country",
                e.target.value
              )
            }
          />

          <input
            type="text"
            placeholder="Partita IVA / VAT (opzionale)"
            value={form.vat_number}
            onChange={(e) =>
              updateField(
                "vat_number",
                e.target.value
              )
            }
          />

          <button
            className="btn btn-save"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Registrazione in corso..."
              : "Registrati"}
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