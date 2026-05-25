import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceListingsTable() {
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");

  async function loadListings() {
    try {
      const response = await api.get("/api/marketplace/listings");
      setListings(response.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento marketplace listings");
    }
  }

  useEffect(() => {
    loadListings();

    const interval = setInterval(loadListings, 10000);

    return () => clearInterval(interval);
  }, []);

  function getSyncStatusBadgeClass(status) {
    switch (status) {
      case "synced":
      case "published":
        return "status-badge status-available";

      case "pending":
        return "status-badge status-pending";

      case "needs_sync":
        return "status-badge status-low";

      case "failed":
      case "deleted":
        return "status-badge status-sold";

      default:
        return "status-badge";
    }
  }

  async function retrySync(listingId) {
    try {
      await api.post(`/api/marketplace/listings/${listingId}/retry`);
      await loadListings();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Errore retry sync marketplace listing",
      );
    }
  }
  async function runRepricing(listingId) {
    try {
      await api.post(`/api/marketplace/listings/${listingId}/run-repricing`);

      await loadListings();
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error || "Errore run repricing marketplace listing",
      );
    }
  }

  async function unpublishListing(listing) {
    const remoteId =
      listing.remote_listing_id || listing.external_listing_id || "";

    const confirmMessage = `Vuoi davvero rimuovere questo listing dal marketplace?\n\nMarketplace: ${listing.marketplace}\nRemote Listing: ${remoteId}`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await api.delete(`/api/marketplace/listings/${listing.id}`);
      await loadListings();
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Errore eliminazione/unpublish marketplace listing",
      );
    }
  }

  function canUnpublish(listing) {
    return (
      listing.sync_status !== "deleted" &&
      Boolean(listing.remote_listing_id || listing.external_listing_id)
    );
  }

  function safeText(value) {
    if (value === null || value === undefined || value === "") return "-";

    if (typeof value === "object") {
      return JSON.stringify(value).slice(0, 80);
    }

    return String(value);
  }

  function safeNumber(value, fallback = "-") {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    const number = Number(value);

    return Number.isNaN(number) ? fallback : `€ ${number.toFixed(2)}`;
  }

  return (
    <div className="section">
      <h2>Marketplace Listings</h2>

      {error && <div className="error">{error}</div>}

      {listings.length === 0 ? (
        <p>Nessun marketplace listing presente.</p>
      ) : (
        <table className="tickets-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Marketplace</th>
              <th>Evento</th>
              <th>Data evento</th>
              <th>Categoria</th>
              <th>Block</th>
              <th>Available</th>
              <th>Partner Price</th>
              <th>Marketplace Price</th>
              <th>Min Price</th>
              <th>Auto Reprice</th>
              <th>Undercut</th>
              <th>Last Market</th>
              <th>Last Suggested</th>
              <th>Sync Status</th>
              <th>Retry</th>

              <th>Next Retry</th>

              <th>Circuit Breaker</th>

              <th>Last Error</th>
              <th>Remote Listing</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id}>
                <td>{listing.id}</td>

                <td>{safeText(listing.marketplace)}</td>

                <td>{safeText(listing.event_name)}</td>
                <td>
                  {listing.event_date
                    ? new Date(listing.event_date).toLocaleString()
                    : "-"}
                </td>

                <td>{safeText(listing.category)}</td>

                <td>{safeText(listing.block)}</td>
                <td>{listing.available_quantity ?? "-"}</td>

                <td>
                  {safeNumber(listing.partner_price || listing.base_price)}
                </td>

                <td>
                  {safeNumber(
                    listing.marketplace_price ||
                      listing.ticket_marketplace_price ||
                      listing.base_price,
                  )}
                </td>

                <td>{safeNumber(listing.min_price)}</td>

                <td>{listing.auto_reprice_enabled ? "ON" : "OFF"}</td>

                <td>{safeNumber(listing.undercut_amount || 0.01)}</td>

                <td>{safeNumber(listing.last_market_price)}</td>

                <td>{safeNumber(listing.last_suggested_price)}</td>

                <td>
                  <span
                    className={getSyncStatusBadgeClass(listing.sync_status)}
                  >
                    {safeText(listing.sync_status).toUpperCase()}
                  </span>
                </td>

                <td>{listing.retry_count ?? 0}</td>

                <td>
                  {listing.next_retry_at
                    ? new Date(listing.next_retry_at).toLocaleString()
                    : "-"}
                </td>

                <td>
                  {listing.circuit_breaker_until
                    ? new Date(listing.circuit_breaker_until).toLocaleString()
                    : "-"}
                </td>

                <td title={safeText(listing.last_error)}>
                  {safeText(listing.last_error)}
                </td>

                <td>
                  {safeText(
                    listing.remote_listing_id || listing.external_listing_id,
                  )}
                </td>

                <td>
                  <div className="marketplace-actions">
                    {["failed", "needs_sync"].includes(listing.sync_status) && (
                      <button
                        className="marketplace-action-btn marketplace-retry-btn"
                        onClick={() => retrySync(listing.id)}
                      >
                        ↻ Retry
                      </button>
                    )}

                    {canUnpublish(listing) && (
                      <button
                        className="marketplace-action-btn marketplace-delist-btn"
                        onClick={() => unpublishListing(listing)}
                      >
                        ⛔ Delist
                      </button>
                    )}

                    {!["failed", "needs_sync"].includes(listing.sync_status) &&
                      !canUnpublish(listing) &&
                      "-"}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default MarketplaceListingsTable;
