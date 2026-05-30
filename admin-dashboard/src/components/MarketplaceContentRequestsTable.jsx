import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceContentRequestsTable() {
  const [requests, setRequests] = useState([]);
  const [activeResolveId, setActiveResolveId] = useState(null);
  const [form, setForm] = useState({
    internal_category: "",
    remote_event_id: "",
    remote_event_name: "",
    remote_category_name: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const response = await api.get("/api/marketplace-content-requests");
      setRequests(response.data.data || []);
    } catch (error) {
      console.error("Error loading marketplace content requests", error);
    }
  }

  function openResolve(request) {
    setActiveResolveId(request.id);

    setForm({
      internal_category: "",
      remote_event_id: request.remote_event_id || "",
      remote_event_name: request.event_name || "",
      remote_category_name: "",
      notes: request.notes || "",
    });
  }

  async function submitResolve(requestId) {
    try {
      setSaving(true);

      await api.post(
        `/api/marketplace-content-requests/${requestId}/resolve-mapping`,
        form,
      );

      setActiveResolveId(null);
      await loadRequests();
    } catch (error) {
      console.error("Error resolving mapping", error);
      alert(error.response?.data?.error || "Errore creazione mapping");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="table-container">
      <table className="marketplace-content-requests-table">
        <thead>
          <tr>
            <th>Marketplace</th>
            <th>Event</th>
            <th>Status</th>
            <th>Remote Event ID</th>
            <th>Notes</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => (
            <>
              <tr key={request.id}>
                <td>{request.marketplace}</td>
                <td>{request.event_name}</td>
                <td>
                  <span
                    className={`content-request-status ${request.request_status}`}
                  >
                    {request.request_status}
                  </span>
                </td>
                <td>
                  <span className="content-request-remote-id">
                    {request.remote_event_id || "-"}
                  </span>
                </td>
                <td className="content-request-notes">
                  {request.notes || "-"}
                </td>
                <td>{new Date(request.created_at).toLocaleString()}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => openResolve(request)}
                  >
                    Resolve Mapping
                  </button>
                </td>
              </tr>

              {activeResolveId === request.id && (
                <tr>
                  <td colSpan="7">
                    <div className="section">
                      <h3>Resolve Mapping</h3>

                      <div className="form-grid">
                        <label>
                          Internal Category
                          <input
                            value={form.internal_category}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                internal_category: e.target.value,
                              })
                            }
                            placeholder="es. Los Vecinos"
                          />
                        </label>

                        <label>
                          Remote Event ID
                          <input
                            value={form.remote_event_id}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                remote_event_id: e.target.value,
                              })
                            }
                            placeholder="UUID evento Ticombo"
                          />
                        </label>

                        <label>
                          Remote Event Name
                          <input
                            value={form.remote_event_name}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                remote_event_name: e.target.value,
                              })
                            }
                            placeholder="es. Bad Bunny"
                          />
                        </label>

                        <label>
                          Remote Category Name
                          <input
                            value={form.remote_category_name}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                remote_category_name: e.target.value,
                              })
                            }
                            placeholder="es. Los Vecinos"
                          />
                        </label>

                        <label>
                          Notes
                          <input
                            value={form.notes}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                notes: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={saving}
                          onClick={() => submitResolve(request.id)}
                        >
                          {saving ? "Saving..." : "Create Mapping"}
                        </button>

                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={() => setActiveResolveId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}

          {requests.length === 0 && (
            <tr>
              <td colSpan="7">No marketplace content requests</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default MarketplaceContentRequestsTable;
