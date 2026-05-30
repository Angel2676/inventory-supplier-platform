import { useState } from "react";
import api from "../api";

function MarketplaceEventSearch() {
  const [marketplace, setMarketplace] = useState("ticombo");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchEvents() {
    if (!keyword.trim()) {
      setError("Inserisci una keyword evento");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await api.get("/api/marketplace/search-events", {
        params: {
          marketplace,
          keyword,
        },
      });

      setResults(response.data?.results || response.data?.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          "Errore ricerca eventi marketplace",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section">
      <h2>Marketplace Event Search</h2>

      <div className="form-grid">
        <div>
          <label>Marketplace</label>
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
          >
            <option value="ticombo">Ticombo</option>
            <option value="sportevents365">SportEvents365</option>
            <option value="gigsberg">Gigsberg</option>
          </select>
        </div>

        <div>
          <label>Keyword</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Es. Ultimo, Real Madrid, AC Milan"
          />
        </div>

        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="btn btn-primary" onClick={searchEvents}>
            {loading ? "Searching..." : "Search Events"}
          </button>
        </div>
      </div>

      {error && <div className="error">{String(error)}</div>}

      {results.length > 0 && (
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
              <tr key={event.id || event.eventId || index}>
                <td>{event.remote_event_id || event.eventId || event.id}</td>
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
      )}

      {!loading && results.length === 0 && !error && (
        <p>Nessun risultato caricato.</p>
      )}
    </div>
  );
}

export default MarketplaceEventSearch;
