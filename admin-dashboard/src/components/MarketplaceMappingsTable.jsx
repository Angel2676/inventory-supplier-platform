import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceMappingsTable() {
  const [mappings, setMappings] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [remoteSearchResults, setRemoteSearchResults] = useState([]);
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false);
  const [publicUrlCsvFile, setPublicUrlCsvFile] = useState(null);
  const [publicUrlImportLoading, setPublicUrlImportLoading] = useState(false);

  const [form, setForm] = useState({
    marketplace: "ticombo",
    mapping_type: "event",
    internal_event_id: "",
    internal_category: "",
    internal_block: "",
    remote_event_id: "",
    remote_event_name: "",
    remote_category_id: "",
    remote_category_name: "",
    remote_block_id: "",
    remote_block_name: "",
    public_url: "",
    notes: "",
    is_active: true,
  });

  async function loadMappings() {
    try {
      const response = await api.get("/api/marketplace/mappings");
      setMappings(response.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento marketplace mappings");
    }
  }
  async function importGigsbergPublicUrls() {
    if (!publicUrlCsvFile) {
      setError("Seleziona un file CSV da importare");
      return;
    }

    try {
      setPublicUrlImportLoading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", publicUrlCsvFile);

      const response = await api.post(
        "/api/marketplace/mappings/import-public-urls",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const { updated = 0, skipped = 0, failed = 0 } = response.data || {};

      alert(
        `Import completato\nAggiornati: ${updated}\nSaltati: ${skipped}\nFalliti: ${failed}`,
      );

      setPublicUrlCsvFile(null);
      await loadMappings();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          "Errore import public URL Gigsberg",
      );
    } finally {
      setPublicUrlImportLoading(false);
    }
  }
  async function exportGigsbergPublicUrls() {
    try {
      setError("");

      const response = await api.get(
        "/api/marketplace/mappings/export-public-urls",
        {
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.setAttribute("download", "gigsberg_public_urls.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Errore export public URL Gigsberg");
    }
  }

  async function loadEvents() {
    try {
      const response = await api.get("/api/events");
      setEvents(response.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadMappings();
    loadEvents();
  }, []);

  async function searchRemoteEvents() {
    try {
      if (!form.marketplace || !form.remote_event_name) {
        setError("Inserisci marketplace e nome evento remoto da cercare");
        return;
      }

      setRemoteSearchLoading(true);

      const response = await api.get("/api/marketplace/search-events", {
        params: {
          marketplace: form.marketplace,
          keyword: form.remote_event_name,
        },
      });

      setRemoteSearchResults(response.data.results || []);
      setError("");
    } catch (err) {
      console.error(err);
      const errorMessage =
        typeof err.response?.data?.error === "string"
          ? err.response.data.error
          : err.response?.data
            ? JSON.stringify(err.response.data)
            : err.message || "Errore ricerca evento marketplace";
      setError(errorMessage);
    } finally {
      setRemoteSearchLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setRemoteSearchResults([]);

    setForm({
      marketplace: "ticombo",
      mapping_type: "event",
      internal_event_id: "",
      internal_category: "",
      internal_block: "",
      remote_event_id: "",
      remote_event_name: "",
      remote_category_id: "",
      remote_category_name: "",
      remote_block_id: "",
      remote_block_name: "",
      public_url: "",
      notes: "",
      is_active: true,
    });
  }

  function startEdit(mapping) {
    setEditingId(mapping.id);
    setRemoteSearchResults([]);

    setForm({
      marketplace: mapping.marketplace || "ticombo",
      mapping_type: mapping.mapping_type || "event",
      internal_event_id: mapping.internal_event_id || "",
      internal_category: mapping.internal_category || "",
      internal_block: mapping.internal_block || "",
      remote_event_id: mapping.remote_event_id || "",
      remote_event_name: mapping.remote_event_name || "",
      remote_category_id: mapping.remote_category_id || "",
      remote_category_name: mapping.remote_category_name || "",
      remote_block_id: mapping.remote_block_id || "",
      remote_block_name: mapping.remote_block_name || "",
      public_url: mapping.public_url || "",
      notes: mapping.notes || "",
      is_active: Boolean(mapping.is_active),
    });
  }

  async function saveMapping() {
    try {
      const payload = {
        marketplace: form.marketplace,
        mapping_type: form.mapping_type,
        internal_event_id: form.internal_event_id
          ? Number(form.internal_event_id)
          : null,
        internal_category: form.internal_category || null,
        internal_block: form.internal_block || null,
        remote_event_id: form.remote_event_id || null,
        remote_event_name: form.remote_event_name || null,
        remote_category_id: form.remote_category_id || null,
        remote_category_name: form.remote_category_name || null,
        remote_block_id: form.remote_block_id || null,
        remote_block_name: form.remote_block_name || null,
        public_url: form.public_url || null,
        notes: form.notes || null,
        is_active: Boolean(form.is_active),
      };

      if (editingId) {
        await api.patch(`/api/marketplace/mappings/${editingId}`, payload);
      } else {
        await api.post("/api/marketplace/mappings", payload);
      }

      resetForm();
      await loadMappings();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Errore salvataggio marketplace mapping",
      );
    }
  }

  async function deleteMapping(id) {
    if (!window.confirm("Eliminare questo mapping?")) return;

    try {
      await api.delete(`/api/marketplace/mappings/${id}`);
      await loadMappings();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Errore eliminazione marketplace mapping",
      );
    }
  }

  function getActiveBadgeClass(isActive) {
    return isActive
      ? "status-badge status-available"
      : "status-badge status-sold";
  }

  function getRemoteEventId(event) {
    return event.id || event.eventId || event.remote_event_id || "-";
  }
  function getRemotePublicUrl(event) {
    const url =
      event.public_url ||
      event.publicUrl ||
      event.url ||
      event.event_url ||
      event.eventUrl ||
      event.link ||
      event.href ||
      "";

    if (url && url.startsWith("/")) {
      return `https://www.gigsberg.com${url}`;
    }

    return url;
  }

  function getRemoteEventName(event) {
    return event.name || event.title || event.remote_event_name || "-";
  }

  function getRemoteVenueName(event) {
    if (typeof event.venue === "string") return event.venue;
    if (event.venue?.name) return event.venue.name;
    if (event.location?.venue) return event.location.venue;
    return "-";
  }

  function getRemoteCity(event) {
    return event.city || event.location?.city || "-";
  }

  function getRemoteDate(event) {
    const rawDate =
      event.start ||
      event.date?.start ||
      event.date?.from ||
      event.date ||
      event.startDate;

    if (!rawDate) return "-";

    try {
      return new Date(rawDate).toLocaleString();
    } catch (_) {
      return String(rawDate);
    }
  }

  return (
    <div className="section">
      <h2>Marketplace Mappings</h2>

      <p>
        Mappa eventi, categorie e blocchi interni verso i corrispondenti ID e
        nomi dei singoli marketplace.
      </p>

      <div className="mapping-actions" style={{ marginBottom: "16px" }}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setPublicUrlCsvFile(e.target.files?.[0] || null)}
        />

        <button
          className="btn btn-secondary"
          type="button"
          onClick={importGigsbergPublicUrls}
          disabled={!publicUrlCsvFile || publicUrlImportLoading}
        >
          {publicUrlImportLoading
            ? "Importing..."
            : "Import Gigsberg Public URLs CSV"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={exportGigsbergPublicUrls}
        >
          Export Gigsberg Public URLs CSV
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="mapping-panel">
        <div className="mapping-panel-header">
          <div>
            <span>Mapping Engine</span>
            <h3>
              {editingId
                ? "Edit Marketplace Mapping"
                : "Create Marketplace Mapping"}
            </h3>
            <p>
              Collega il tuo evento interno agli ID remoti del marketplace per
              automatizzare publish, repricing e sync.
            </p>
          </div>

          {editingId && (
            <button className="btn btn-secondary" onClick={resetForm}>
              Nuovo Mapping
            </button>
          )}
        </div>

        <div className="mapping-grid">
          <div className="mapping-card">
            <h4>Internal Inventory</h4>

            <div className="mapping-card-fields">
              <select
                value={form.marketplace}
                onChange={(e) =>
                  setForm({
                    ...form,
                    marketplace: e.target.value,
                  })
                }
              >
                <option value="gigsberg">Gigsberg</option>
                <option value="ticombo">Ticombo</option>
                <option value="sportevents365">SportEvents365</option>
              </select>

              <select
                value={form.mapping_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mapping_type: e.target.value,
                  })
                }
              >
                <option value="event">Event Mapping</option>
                <option value="category">Category Mapping</option>
                <option value="block">Block Mapping</option>
              </select>

              <select
                value={form.internal_event_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    internal_event_id: e.target.value,
                  })
                }
              >
                <option value="">Select internal event</option>

                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Internal category, e.g. PIT 1"
                value={form.internal_category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    internal_category: e.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Internal block, e.g. A / West Stand"
                value={form.internal_block}
                onChange={(e) =>
                  setForm({
                    ...form,
                    internal_block: e.target.value,
                  })
                }
              />

              <div className="mapping-toggle-row">
                <div>
                  <strong>Active mapping</strong>
                  <span>
                    Enable this mapping for marketplace publishing and sync
                  </span>
                </div>

                <label className="mapping-switch">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        is_active: e.target.checked,
                      })
                    }
                  />
                  <span></span>
                </label>
              </div>
            </div>
          </div>

          <div className="mapping-card">
            <h4>Remote Marketplace</h4>

            <div className="mapping-card-fields">
              <input
                type="text"
                placeholder="Remote event ID"
                value={form.remote_event_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remote_event_id: e.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Remote event name"
                value={form.remote_event_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remote_event_name: e.target.value,
                  })
                }
              />

              <button
                className="btn btn-secondary"
                type="button"
                onClick={searchRemoteEvents}
              >
                {remoteSearchLoading ? "Searching..." : "Search Remote Event"}
              </button>

              <input
                type="text"
                placeholder="Remote category ID"
                value={form.remote_category_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remote_category_id: e.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Remote category name"
                value={form.remote_category_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remote_category_name: e.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Remote block ID"
                value={form.remote_block_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remote_block_id: e.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Remote block name"
                value={form.remote_block_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remote_block_name: e.target.value,
                  })
                }
              />

              <input
                type="text"
                placeholder="Public URL"
                value={form.public_url}
                onChange={(e) =>
                  setForm({
                    ...form,
                    public_url: e.target.value,
                  })
                }
              />

              {form.public_url && (
                <a
                  href={form.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  Open Public URL
                </a>
              )}

              <input
                type="text"
                placeholder="Internal notes"
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="mapping-actions">
          {editingId && (
            <button className="btn btn-secondary" onClick={resetForm}>
              Annulla
            </button>
          )}

          <button className="btn btn-save" onClick={saveMapping}>
            {editingId ? "Aggiorna Mapping" : "Crea Mapping"}
          </button>
        </div>
      </div>

      {remoteSearchResults.length > 0 && (
        <div className="remote-results-card">
          <h3>Remote Event Results</h3>

          <table className="tickets-table">
            <thead>
              <tr>
                <th>Remote ID</th>
                <th>Name</th>
                <th>Venue</th>
                <th>City</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {remoteSearchResults.map((event, index) => {
                const remoteEventId = getRemoteEventId(event);
                const remoteEventName = getRemoteEventName(event);

                return (
                  <tr key={remoteEventId || index}>
                    <td>{remoteEventId}</td>
                    <td>{remoteEventName}</td>
                    <td>{getRemoteVenueName(event)}</td>
                    <td>{getRemoteCity(event)}</td>
                    <td>{getRemoteDate(event)}</td>
                    <td>
                      <button
                        className="btn btn-save"
                        onClick={() => {
                          setForm({
                            ...form,
                            remote_event_id: remoteEventId,
                            remote_event_name: remoteEventName,
                            public_url:
                              getRemotePublicUrl(event) || form.public_url,
                          });

                          setRemoteSearchResults([]);
                        }}
                      >
                        Use this event
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {mappings.length === 0 ? (
        <p>Nessun mapping marketplace presente.</p>
      ) : (
        <table className="tickets-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Marketplace</th>
              <th>Type</th>
              <th>Internal Event</th>
              <th>Internal Category</th>
              <th>Internal Block</th>
              <th>Remote Event</th>
              <th>Remote Category</th>
              <th>Remote Block</th>
              <th>Active</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.id}>
                <td>{mapping.id}</td>

                <td>
                  <span className="mapping-marketplace-pill">
                    {mapping.marketplace}
                  </span>
                </td>

                <td>
                  <span className="mapping-type-pill">
                    {mapping.mapping_type}
                  </span>
                </td>

                <td>
                  {mapping.internal_event_name ||
                    mapping.internal_event_id ||
                    "-"}
                </td>

                <td>{mapping.internal_category || "-"}</td>

                <td>{mapping.internal_block || "-"}</td>

                <td>
                  {mapping.remote_event_name || "-"}
                  {mapping.remote_event_id
                    ? ` (${mapping.remote_event_id})`
                    : ""}
                </td>

                <td>
                  {mapping.remote_category_name || "-"}
                  {mapping.remote_category_id
                    ? ` (${mapping.remote_category_id})`
                    : ""}
                </td>

                <td>
                  {mapping.remote_block_name || "-"}
                  {mapping.remote_block_id
                    ? ` (${mapping.remote_block_id})`
                    : ""}
                </td>

                <td>
                  <span className={getActiveBadgeClass(mapping.is_active)}>
                    {mapping.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>

                <td>{mapping.notes || "-"}</td>

                <td className="actions-cell">
                  <button
                    className="btn btn-edit"
                    onClick={() => startEdit(mapping)}
                  >
                    Modifica
                  </button>

                  <button
                    className="btn btn-delete"
                    onClick={() => deleteMapping(mapping.id)}
                  >
                    Elimina
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MarketplaceMappingsTable;
