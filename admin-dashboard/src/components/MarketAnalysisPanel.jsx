import { useState } from "react";
import api from "../api";

export default function MarketAnalysisPanel() {
  const [eventId, setEventId] = useState("");
  const [category, setCategory] = useState("");
  const [block, setBlock] = useState("");
  const [marketplaces, setMarketplaces] = useState(["gigsberg", "ticombo"]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        <input
          type="number"
          placeholder="Event ID"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        />

        <input
          type="text"
          placeholder="Settore / Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <input
          type="text"
          placeholder="Blocco opzionale"
          value={block}
          onChange={(e) => setBlock(e.target.value)}
        />

        <div className="marketplace-checkboxes">
          {["gigsberg", "ticombo"].map((marketplace) => (
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
              </tr>
            </thead>
            <tbody>
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
                </tr>
              ))}
            </tbody>
          </table>

          {analysis.results.map((result) =>
            result.rawData?.length ? (
              <div key={`${result.marketplace}-details`}>
                <h4>{result.marketplace} dettagli</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Listing ID</th>
                      <th>Remote ID</th>
                      <th>Ticket ID</th>
                      <th>Settore</th>
                      <th>Blocco</th>
                      <th>Marketplace Price</th>
                      <th>Market Price</th>
                      <th>Suggested</th>
                      <th>Min Price</th>
                      <th>Your Price</th>
                      <th>Market Ref.</th>
                      <th>Diff.</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rawData.map((row) => (
                      <tr key={`${result.marketplace}-${row.listing_id}`}>
                        <td>{row.listing_id}</td>
                        <td>{row.remote_listing_id}</td>
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
