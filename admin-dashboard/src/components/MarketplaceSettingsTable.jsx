import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceSettingsTable() {
  const [settings, setSettings] = useState([]);
  const [editingMarketplace, setEditingMarketplace] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState("");

  async function loadSettings() {
    try {
      const response = await api.get("/api/marketplace/settings");
      setSettings(response.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento marketplace settings");
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function startEdit(setting) {
    setEditingMarketplace(setting.marketplace);

    setEditForm({
      enabled: Boolean(setting.enabled),
      environment: setting.environment || "sandbox",
      default_min_price: setting.default_min_price || "",
      default_undercut_amount: setting.default_undercut_amount || "0.01",
      api_configured: Boolean(setting.api_configured),
      notes: setting.notes || ""
    });
  }

  function cancelEdit() {
    setEditingMarketplace(null);
    setEditForm({});
  }

  async function saveEdit(marketplace) {
    try {
      await api.patch(`/api/marketplace/settings/${marketplace}`, {
        enabled: Boolean(editForm.enabled),
        environment: editForm.environment,
        default_min_price: editForm.default_min_price
          ? Number(editForm.default_min_price)
          : null,
        default_undercut_amount: Number(
          editForm.default_undercut_amount || 0.01
        ),
        api_configured: Boolean(editForm.api_configured),
        notes: editForm.notes || ""
      });

      setEditingMarketplace(null);
      await loadSettings();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Errore aggiornamento marketplace settings"
      );
    }
  }

  function getEnvironmentBadgeClass(environment) {
    if (environment === "production") {
      return "status-badge status-available";
    }

    return "status-badge status-pending";
  }

  function getEnabledBadgeClass(enabled) {
    return enabled
      ? "status-badge status-available"
      : "status-badge status-sold";
  }

  return (
    <div className="section">
      <h2>Marketplace Settings</h2>

      <p>
        Gestisci abilitazione marketplace, ambiente operativo, default pricing e
        stato configurazione API.
      </p>

      {error && <div className="error">{error}</div>}

      {settings.length === 0 ? (
        <p>Nessun marketplace configurato.</p>
      ) : (
        <table className="tickets-table">
          <thead>
            <tr>
              <th>Marketplace</th>
              <th>Enabled</th>
              <th>Environment</th>
              <th>Default Min Price</th>
              <th>Default Undercut</th>
              <th>API Configured</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {settings.map((setting) => {
              const isEditing = editingMarketplace === setting.marketplace;

              return (
                <tr key={setting.marketplace}>
                  <td>
                    <strong>{setting.marketplace}</strong>
                  </td>

                  <td>
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editForm.enabled}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            enabled: e.target.checked
                          })
                        }
                      />
                    ) : (
                      <span className={getEnabledBadgeClass(setting.enabled)}>
                        {setting.enabled ? "ENABLED" : "DISABLED"}
                      </span>
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <select
                        className="table-input"
                        value={editForm.environment}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            environment: e.target.value
                          })
                        }
                      >
                        <option value="sandbox">sandbox</option>
                        <option value="production">production</option>
                      </select>
                    ) : (
                      <span
                        className={getEnvironmentBadgeClass(
                          setting.environment
                        )}
                      >
                        {(setting.environment || "sandbox").toUpperCase()}
                      </span>
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        type="number"
                        step="0.01"
                        value={editForm.default_min_price}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            default_min_price: e.target.value
                          })
                        }
                      />
                    ) : setting.default_min_price ? (
                      `€ ${Number(setting.default_min_price).toFixed(2)}`
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        type="number"
                        step="0.01"
                        value={editForm.default_undercut_amount}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            default_undercut_amount: e.target.value
                          })
                        }
                      />
                    ) : (
                      `€ ${Number(
                        setting.default_undercut_amount || 0.01
                      ).toFixed(2)}`
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editForm.api_configured}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            api_configured: e.target.checked
                          })
                        }
                      />
                    ) : (
                      <span
                        className={getEnabledBadgeClass(setting.api_configured)}
                      >
                        {setting.api_configured ? "YES" : "NO"}
                      </span>
                    )}
                  </td>

                  <td>
                    {isEditing ? (
                      <input
                        className="table-input"
                        type="text"
                        value={editForm.notes}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            notes: e.target.value
                          })
                        }
                      />
                    ) : (
                      setting.notes || "-"
                    )}
                  </td>

                  <td className="actions-cell">
                    {isEditing ? (
                      <>
                        <button
                          className="btn btn-save"
                          onClick={() => saveEdit(setting.marketplace)}
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
                      <button
                        className="btn btn-edit"
                        onClick={() => startEdit(setting)}
                      >
                        Modifica
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MarketplaceSettingsTable;
