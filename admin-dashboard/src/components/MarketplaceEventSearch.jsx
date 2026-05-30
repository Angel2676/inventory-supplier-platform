import { useState } from "react";
import api from "../api";

function MarketplaceEventSearch() {
  const [marketplace, setMarketplace] = useState("ticombo");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setResults([]);

      console.log("Searching marketplace events:", {
        marketplace,
        keyword: cleanKeyword,
      });

      const response = await api.get("/api/marketplace/search-events", {
        params: {
          marketplace,
          keyword: cleanKeyword,
        },
      });

      console.log("Marketplace event search response:", response.data);

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
          data da usare nei mappings.
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
              </tr>
            </thead>

            <tbody>
              {results.map((event, index) => (
                <tr
                  key={
                    event.remote_event_id || event.eventId || event.id || index
                  }
                >
                  <td>
                    {event.remote_event_id || event.eventId || event.id || "-"}
                  </td>

                  <td>{event.name || event.eventName || "-"}</td>

                  <td>{event.venue || event.eventVenue || "-"}</td>

                  <td>{event.city || "-"}</td>

                  <td>
                    {event.date
                      ? new Date(event.date).toLocaleString()
                      : event.eventDate || "-"}
                  </td>
                </tr>
              ))}
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
