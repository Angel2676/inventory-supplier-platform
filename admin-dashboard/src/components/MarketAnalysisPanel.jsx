import { useEffect, useState } from "react";
import api from "../api";

export default function MarketAnalysisPanel() {
  const [eventId, setEventId] = useState("");
  const [category, setCategory] = useState("");
  const [block, setBlock] = useState("");
  const [marketplaces, setMarketplaces] = useState(["gigsberg", "ticombo"]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [detailStatusFilter, setDetailStatusFilter] = useState("all");

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await api.get("/api/market-analysis/events");
        setEvents(response.data.events || []);
      } catch (err) {
        console.error("Errore caricamento eventi", err);
      }
    }

    loadEvents();
  }, []);

  useEffect(() => {
    async function loadCategories() {
      if (!eventId) {
        setCategories([]);
        return;
      }

      try {
        const response = await api.get(
          `/api/market-analysis/events/${eventId}/categories`,
        );
        setCategories(response.data.categories || []);
      } catch (err) {
        console.error("Errore caricamento categorie", err);
      }
    }

    loadCategories();
  }, [eventId]);

  const toggleMarketplace = (marketplace) => {
    setMarketplaces((current) =>
      current.includes(marketplace)
        ? current.filter((item) => item !== marketplace)
        : [...current, marketplace],
    );
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const response = await api.post("/api/market-analysis/run", {
        eventId: Number(eventId),
        category: category || null,
        block: block || null,
        marketplaces,
      });

      setAnalysis(response.data.analysis);
    } catch (err) {
      setError(err.message || "Errore analisi mercato");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="market-analysis-panel">
      <h2>Market Analysis</h2>

      <div className="market-analysis-form">
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setCategory("");
            setBlock("");
          }}
        >
          <option value="">Seleziona evento</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} - {event.city} -{" "}
              {new Date(event.event_date).toLocaleDateString("it-IT")}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => {
            const selected = categories.find(
              (item) => item.category === e.target.value,
            );

            setCategory(e.target.value);
            setBlock(selected?.block || "");
          }}
          disabled={!eventId}
        >
          <option value="">Tutti i settori</option>
          {categories.map((item) => (
            <option
              key={`${item.category}-${item.block}`}
              value={item.category}
            >
              {item.category}
              {item.block ? ` - Blocco ${item.block}` : ""}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Blocco opzionale"
          value={block}
          onChange={(e) => setBlock(e.target.value)}
        />

        <div className="marketplace-checkboxes">
          {[
            "gigsberg",
            "ticombo",
            "footballticketnet",
            "seatpin",
            "viagogo",
            "sportevents365",
          ].map((marketplace) => (
            <label key={marketplace}>
              <input
                type="checkbox"
                checked={marketplaces.includes(marketplace)}
                onChange={() => toggleMarketplace(marketplace)}
              />
              {marketplace}
            </label>
          ))}
        </div>

        <button onClick={runAnalysis} disabled={loading || !eventId}>
          {loading ? "Analisi in corso..." : "Analyze Market"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {analysis && (
        <div className="market-analysis-results">
          <h3>
            Risultati evento #{analysis.eventId}
            {analysis.category ? ` - ${analysis.category}` : ""}
            {analysis.block ? ` - Blocco ${analysis.block}` : ""}
          </h3>

          <table>
            <thead>
              <tr>
                <th>Marketplace</th>
                <th>Settore</th>
                <th>Blocco</th>
                <th>Lowest</th>
                <th>Average</th>
                <th>Highest</th>
                <th>Listings</th>
                <th>Status</th>
                <th>Public URL</th>
              </tr>
            </thead>
            <tbody>
              {analysis.results.map((result) =>
                result.marketplace === "footballticketnet" &&
                result.rows?.length ? (
                  <div key={`${result.marketplace}-rows`}>
                    <h4>FootballTicketNet dettagli live</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Ticket ID</th>
                          <th>Remote Category</th>
                          <th>Settore</th>
                          <th>Blocco</th>
                          <th>Prezzo</th>
                          <th>Max Qty</th>
                          <th>Qty List</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, index) => (
                          <tr key={`${row.ticketId || "ftn"}-${index}`}>
                            <td>{row.ticketId || "-"}</td>
                            <td>{row.remoteCategoryId || "-"}</td>
                            <td>{row.category || "-"}</td>
                            <td>{row.block || "-"}</td>
                            <td>
                              {row.price ? `${row.price} ${row.currency}` : "-"}
                            </td>
                            <td>{row.maxQty || "-"}</td>
                            <td>{row.qtyList || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null,
              )}
              {analysis.results.map((result) => (
                <tr key={result.marketplace}>
                  <td>{result.marketplace}</td>
                  <td>{result.category || "-"}</td>
                  <td>{result.block || "-"}</td>
                  <td>
                    {result.lowestPrice !== null
                      ? `${result.lowestPrice} ${result.currency}`
                      : "-"}
                  </td>
                  <td>
                    {result.averagePrice !== null
                      ? `${result.averagePrice} ${result.currency}`
                      : "-"}
                  </td>
                  <td>
                    {result.highestPrice !== null
                      ? `${result.highestPrice} ${result.currency}`
                      : "-"}
                  </td>
                  <td>{result.listingsCount}</td>
                  <td>{result.status}</td>
                  <td>
                    {result.publicUrl ? (
                      <a
                        href={result.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Apri
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="detail-filters">
            <label>
              Status dettagli
              <select
                value={detailStatusFilter}
                onChange={(e) => setDetailStatusFilter(e.target.value)}
              >
                <option value="all">Tutti</option>
                <option value="active">Active</option>
                <option value="removed">Removed</option>
                <option value="expired">Expired</option>
                <option value="non_active">Non Active</option>
              </select>
            </label>
          </div>
          {analysis.results.map((result) =>
            result.rawData?.length ? (
              <div key={`${result.marketplace}-details`}>
                {result.liveMarket && (
                  <div className="live-market-card">
                    <h4>📡 Live Market ({result.liveMarket.source})</h4>

                    <div className="live-market-grid">
                      <div>
                        <strong>Lowest</strong>
                        <p>
                          {result.liveMarket.lowestPrice !== null
                            ? `€ ${result.liveMarket.lowestPrice}`
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <strong>Average</strong>
                        <p>
                          {result.liveMarket.averagePrice !== null
                            ? `€ ${result.liveMarket.averagePrice}`
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <strong>Highest</strong>
                        <p>
                          {result.liveMarket.highestPrice !== null
                            ? `€ ${result.liveMarket.highestPrice}`
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <strong>Listings</strong>
                        <p>{result.liveMarket.listingsCount ?? "-"}</p>
                      </div>
                    </div>
                  </div>
                )}

                <h4>{result.marketplace} dettagli</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Listing ID</th>
                      <th>Remote ID</th>
                      <th>Status</th>
                      <th>Ticket ID</th>
                      <th>Settore</th>
                      <th>Blocco</th>
                      <th>Marketplace Price</th>
                      <th>Market Price</th>
                      <th>Suggested</th>
                      <th>Min Price</th>
                      <th>Your Price</th>
                      <th>DB Market Ref.</th>
                      <th>DB Diff.</th>
                      <th>Live Market</th>
                      <th>Live Diff.</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rawData
                      .filter((row) => {
                        const status = String(
                          row.status || row.listing_status || "",
                        ).toLowerCase();

                        if (detailStatusFilter === "all") return true;

                        if (detailStatusFilter === "non_active") {
                          return status && status !== "active";
                        }

                        return status === detailStatusFilter;
                      })
                      .map((row) => (
                        <tr key={`${result.marketplace}-${row.listing_id}`}>
                          <td>{row.listing_id}</td>
                          <td>{row.remote_listing_id}</td>
                          <td>{row.status || row.listing_status || "-"}</td>
                          <td>{row.ticket_id}</td>
                          <td>{row.category || "-"}</td>
                          <td>{row.block || "-"}</td>
                          <td>{row.marketplace_price || "-"}</td>
                          <td>
                            {row.listing_last_market_price ||
                              row.ticket_last_market_price ||
                              "-"}
                          </td>
                          <td>{row.last_suggested_price || "-"}</td>
                          <td>{row.min_price || "-"}</td>
                          <td>{row.your_price ?? "-"}</td>
                          <td>{row.market_reference_price ?? "-"}</td>
                          <td>{row.market_difference ?? "-"}</td>
                          <td>{result.liveMarket?.lowestPrice ?? "-"}</td>
                          <td>
                            {result.liveMarket?.lowestPrice && row.your_price
                              ? Number(
                                  (
                                    row.your_price -
                                    result.liveMarket.lowestPrice
                                  ).toFixed(2),
                                )
                              : "-"}
                          </td>
                          <td>
                            {row.market_position === "over_market" &&
                              "🔴 OVER MARKET"}
                            {row.market_position === "under_market" &&
                              "🟢 UNDER MARKET"}
                            {row.market_position === "at_market" &&
                              "🟡 AT MARKET"}
                            {row.market_position === "unknown" && "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
