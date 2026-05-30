import { useEffect, useState } from "react";
import api from "../api";

function getRemoteEventId(event) {
  return event.remote_event_id || event.eventId || event.id || "";
}

function getRemoteEventName(event) {
  return event.name || event.eventName || "";
}

function MarketplaceEventSearch() {
  const [marketplace, setMarketplace] = useState("ticombo");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const [activeMappingKey, setActiveMappingKey] = useState(null);
  const [internalEvents, setInternalEvents] = useState([]);

  const [mappingForm, setMappingForm] = useState({
    internal_event_id: "",
    internal_category: "",
    internal_block: "",
    remote_event_id: "",
    remote_event_name: "",
    remote_category_name: "",
    remote_block_name: "",
  });

  async function searchEvents(e) {
    if (e) e.preventDefault();

    const cleanKeyword = keyword.trim();

    if (!cleanKeyword) {
      setError("Inserisci una keyword evento");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setResults([]);

      const response = await api.get("/api/marketplace/search-events", {
        params: {
          marketplace,
          keyword: cleanKeyword,
        },
      });

      const items = response.data?.results || response.data?.data || [];

      setResults(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error("Marketplace event search error:", err);

      setError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          err.message ||
          "Errore ricerca eventi marketplace",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadInternalEvents() {
    try {
      const response = await api.get("/api/events");

      setInternalEvents(response.data || []);
    } catch (error) {
      console.error("Error loading internal events", error);
    }
  }

  useEffect(() => {
    loadInternalEvents();
  }, []);

  function openFullMapping(event, index) {
    const remoteEventId = getRemoteEventId(event);
    const remoteEventName = getRemoteEventName(event);

    setActiveMappingKey(remoteEventId || String(index));
    setError("");
    setSuccess("");

    setMappingForm({
      internal_event_id: "",

      internal_category: "",

      internal_block: "",

      remote_event_id: remoteEventId,

      remote_event_name: remoteEventName,

      remote_category_name: "",

      remote_block_name: "",
    });
  }

  async function createFullMapping() {
    const internalEventId = Number(mappingForm.internal_event_id);

    if (!internalEventId) {
      setError("Internal Event ID obbligatorio");
      return;
    }

    if (!mappingForm.remote_event_id) {
      setError("Remote Event ID obbligatorio");
      return;
    }

    if (!mappingForm.internal_category.trim()) {
      setError("Internal Category obbligatoria");
      return;
    }

    if (!mappingForm.remote_category_name.trim()) {
      setError("Remote Category Name obbligatoria");
      return;
    }

    try {
      setSavingMapping(true);
      setError("");
      setSuccess("");

      await api.post("/api/marketplace/mappings", {
        marketplace,
        mapping_type: "event",
        internal_event_id: internalEventId,
        remote_event_id: mappingForm.remote_event_id,
        remote_event_name: mappingForm.remote_event_name || null,

        is_active: true,
      });

      if (
        mappingForm.internal_block.trim() &&
        mappingForm.remote_block_name.trim()
      ) {
        await api.post("/api/marketplace/mappings", {
          marketplace,
          mapping_type: "block",
          internal_event_id: internalEventId,
          internal_category: mappingForm.internal_category.trim(),
          internal_block: mappingForm.internal_block.trim(),
          remote_event_id: mappingForm.remote_event_id,
          remote_event_name: mappingForm.remote_event_name || null,
          remote_category_name: mappingForm.remote_category_name.trim(),
          remote_block_name: mappingForm.remote_block_name.trim(),

          is_active: true,
        });
      }

      await api.post("/api/marketplace/mappings", {
        marketplace,
        mapping_type: "category",
        internal_event_id: internalEventId,
        internal_category: mappingForm.internal_category.trim(),
        remote_event_id: mappingForm.remote_event_id,
        remote_event_name: mappingForm.remote_event_name || null,
        remote_category_name: mappingForm.remote_category_name.trim(),

        is_active: true,
      });

      setSuccess("Mapping evento + categoria creati correttamente");
      setActiveMappingKey(null);
    } catch (err) {
      console.error("Create full mapping error:", err);
      setError(
        err.response?.data?.error || err.message || "Errore creazione mapping",
      );
    } finally {
      setSavingMapping(false);
    }
  }

  return (
    <div
      className="section"
      style={{
        padding: "18px",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        background: "#fff",
      }}
    >
      <div style={{ marginBottom: "14px" }}>
        <h3 style={{ margin: 0 }}>Marketplace Event Search</h3>
        <p style={{ margin: "6px 0 0", color: "#666", fontSize: "14px" }}>
          Cerca eventi remoti su Ticombo per recuperare ID evento, nome, venue e
          data. Da qui puoi creare direttamente Event Mapping e Category
          Mapping.
        </p>
      </div>

      <form
        onSubmit={searchEvents}
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr 160px",
          gap: "12px",
          alignItems: "end",
          marginBottom: "16px",
        }}
      >
        <div>
          <label
            style={{ display: "block", fontSize: "13px", marginBottom: 6 }}
          >
            Marketplace
          </label>

          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            style={{
              width: "100%",
              height: "40px",
              padding: "8px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          >
            <option value="ticombo">Ticombo</option>
            <option value="sportevents365">SportEvents365</option>
            <option value="gigsberg">Gigsberg</option>
          </select>
        </div>

        <div>
          <label
            style={{ display: "block", fontSize: "13px", marginBottom: 6 }}
          >
            Keyword evento
          </label>

          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Es. Ultimo, Real Madrid, AC Milan"
            style={{
              width: "100%",
              height: "40px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{
            height: "40px",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Searching..." : "Search Events"}
        </button>
      </form>

      {error && (
        <div className="error" style={{ marginBottom: "12px" }}>
          {String(error)}
        </div>
      )}

      {success && (
        <div className="success" style={{ marginBottom: "12px" }}>
          {success}
        </div>
      )}

      {results.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table className="tickets-table">
            <thead>
              <tr>
                <th>Remote Event ID</th>
                <th>Name</th>
                <th>Venue</th>
                <th>City</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {results.map((event, index) => {
                const remoteEventId = getRemoteEventId(event);
                const remoteEventName = getRemoteEventName(event);
                const rowKey = remoteEventId || String(index);

                return (
                  <>
                    <tr key={rowKey}>
                      <td>{remoteEventId || "-"}</td>

                      <td>{remoteEventName || "-"}</td>

                      <td>{event.venue || event.eventVenue || "-"}</td>

                      <td>{event.city || "-"}</td>

                      <td>
                        {event.date
                          ? new Date(event.date).toLocaleString()
                          : event.eventDate || "-"}
                      </td>

                      <td>
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => openFullMapping(event, index)}
                        >
                          Create Full Mapping
                        </button>
                      </td>
                    </tr>

                    {activeMappingKey === rowKey && (
                      <tr key={`${rowKey}-mapping`}>
                        <td colSpan="6">
                          <div
                            className="section"
                            style={{
                              background: "#f9fafb",
                              border: "1px solid #e5e7eb",
                              borderRadius: "10px",
                              padding: "14px",
                            }}
                          >
                            <div style={{ marginBottom: 14 }}>
                              <h4 style={{ margin: 0 }}>
                                Create Marketplace Mapping
                              </h4>
                              <p
                                style={{
                                  margin: "6px 0 0",
                                  color: "#6b7280",
                                  fontSize: 13,
                                }}
                              >
                                Crea il mapping evento/categoria. Il block
                                mapping è opzionale e va usato solo se vuoi
                                pubblicare settori specifici.
                              </p>
                            </div>

                            <div
                              style={{
                                background: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 10,
                                padding: 12,
                                marginBottom: 12,
                              }}
                            >
                              <h5
                                style={{ margin: "0 0 10px", color: "#111827" }}
                              >
                                Internal Inventory
                              </h5>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(220px, 1fr))",
                                  gap: "12px",
                                }}
                              >
                                <label>
                                  Internal Event
                                  <select
                                    value={mappingForm.internal_event_id}
                                    onChange={(e) =>
                                      setMappingForm({
                                        ...mappingForm,
                                        internal_event_id: e.target.value,
                                      })
                                    }
                                  >
                                    <option value="">
                                      Select internal event
                                    </option>

                                    {internalEvents.map((event) => (
                                      <option key={event.id} value={event.id}>
                                        #{event.id} - {event.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  Internal Category
                                  <input
                                    value={mappingForm.internal_category}
                                    onChange={(e) =>
                                      setMappingForm({
                                        ...mappingForm,
                                        internal_category: e.target.value,
                                      })
                                    }
                                    placeholder="Es. Terzo Anello Rosso"
                                  />
                                </label>

                                <label>
                                  Internal Block{" "}
                                  <span style={{ color: "#9ca3af" }}>
                                    (optional)
                                  </span>
                                  <input
                                    value={mappingForm.internal_block}
                                    onChange={(e) =>
                                      setMappingForm({
                                        ...mappingForm,
                                        internal_block: e.target.value,
                                      })
                                    }
                                    placeholder="Es. 329"
                                  />
                                </label>
                              </div>
                            </div>

                            <div
                              style={{
                                background: "#ffffff",
                                border: "1px solid #e5e7eb",
                                borderRadius: 10,
                                padding: 12,
                              }}
                            >
                              <h5
                                style={{ margin: "0 0 10px", color: "#111827" }}
                              >
                                Marketplace Mapping
                              </h5>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(220px, 1fr))",
                                  gap: "12px",
                                }}
                              >
                                <label>
                                  Remote Event ID
                                  <input
                                    value={mappingForm.remote_event_id}
                                    readOnly
                                    style={{
                                      background: "#f3f4f6",
                                      color: "#374151",
                                    }}
                                  />
                                </label>

                                <label>
                                  Remote Event Name
                                  <input
                                    value={mappingForm.remote_event_name}
                                    readOnly
                                    style={{
                                      background: "#f3f4f6",
                                      color: "#374151",
                                    }}
                                  />
                                </label>

                                <label>
                                  Remote Category Name
                                  <input
                                    value={mappingForm.remote_category_name}
                                    onChange={(e) =>
                                      setMappingForm({
                                        ...mappingForm,
                                        remote_category_name: e.target.value,
                                      })
                                    }
                                    placeholder="Es. Third Red Ring"
                                  />
                                </label>

                                <label>
                                  Remote Block Name{" "}
                                  <span style={{ color: "#9ca3af" }}>
                                    (optional)
                                  </span>
                                  <input
                                    value={mappingForm.remote_block_name}
                                    onChange={(e) =>
                                      setMappingForm({
                                        ...mappingForm,
                                        remote_block_name: e.target.value,
                                      })
                                    }
                                    placeholder="Es. Section 329"
                                  />
                                </label>
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: "12px",
                                display: "flex",
                                gap: "8px",
                              }}
                            >
                              <button
                                className="btn btn-primary"
                                type="button"
                                disabled={savingMapping}
                                onClick={createFullMapping}
                              >
                                {savingMapping ? "Saving..." : "Save Mapping"}
                              </button>

                              <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={() => setActiveMappingKey(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        !loading &&
        !error && (
          <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
            Nessun risultato caricato.
          </p>
        )
      )}
    </div>
  );
}

export default MarketplaceEventSearch;
