import { useState } from "react";

import api from "../api";
import { useAuth } from "../context/AuthContext";

function LoginPage({ onShowRegister }) {
  const { login } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

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

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/auth/login", {
        email: form.email,
        password: form.password
      });

      login(response.data);

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error ||
          "Errore login"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Inventory Supplier Platform</h1>

        <p>Login amministratore / partner</p>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
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

          <button
            className="btn btn-save"
            type="submit"
            disabled={loading}
          >
            {loading ? "Accesso..." : "Login"}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={onShowRegister}
          >
            Registrati come partner
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;