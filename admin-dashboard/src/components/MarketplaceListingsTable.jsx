import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceListingsTable() {
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoRepriceFilter, setAutoRepriceFilter] = useState("all");
  const [errorsOnly, setErrorsOnly] = useState(false);

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

  function safeText(value) {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
    return String(value);
  }

  function safeNumber(value, fallback = "-") {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    return Number.isNaN(number) ? fallback : `€ ${number.toFixed(2)}`;
  }

  function getSyncStatusBadgeClass(status) {
    switch (status) {
      case "synced":
      case "published":
        return "status-pill success";
      case "pending":
        return "status-pill warning";
      case "needs_sync":
        return "status-pill attention";
      case "failed":
      case "deleted":
        return "status-pill danger";
      default:
        return "status-pill neutral";
    }
  }

  function getPricingStatus(listing) {
    const current = Number(
      listing.marketplace_price ||
        listing.ticket_marketplace_price ||
        listing.base_price ||
        0,
    );

    const min = Number(listing.min_price || 0);

    if (!min || !current) {
      return { label: "UNKNOWN", className: "neutral" };
    }

    if (current <= min) {
      return { label: "DANGER", className: "danger" };
    }

    if (current <= min * 1.15) {
      return { label: "NEAR MIN", className: "warning" };
    }

    return { label: "SAFE", className: "success" };
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
      const response = await api.post(
        `/api/marketplace/listings/${listingId}/run-repricing`,
      );

      alert(
        response.data.updated
          ? `Repricing completato. Nuovo prezzo: € ${response.data.new_price}`
          : `Nessun aggiornamento necessario (${response.data.reason})`,
      );

      await loadListings();
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.error || "Errore run repricing marketplace listing",
      );
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

  const filteredListings = listings.filter((listing) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      !search ||
      String(listing.id || "")
        .toLowerCase()
        .includes(search) ||
      String(listing.marketplace || "")
        .toLowerCase()
        .includes(search) ||
      String(listing.event_name || "")
        .toLowerCase()
        .includes(search) ||
      String(listing.category || "")
        .toLowerCase()
        .includes(search) ||
      String(listing.block || "")
        .toLowerCase()
        .includes(search) ||
      String(listing.remote_listing_id || "")
        .toLowerCase()
        .includes(search) ||
      String(listing.external_listing_id || "")
        .toLowerCase()
        .includes(search);

    const matchesMarketplace =
      marketplaceFilter === "all" || listing.marketplace === marketplaceFilter;

    const matchesStatus =
      statusFilter === "all" || listing.sync_status === statusFilter;

    const matchesAutoReprice =
      autoRepriceFilter === "all" ||
      (autoRepriceFilter === "on" && listing.auto_reprice_enabled) ||
      (autoRepriceFilter === "off" && !listing.auto_reprice_enabled);

    const matchesErrors = !errorsOnly || Boolean(listing.last_error);

    return (
      matchesSearch &&
      matchesMarketplace &&
      matchesStatus &&
      matchesAutoReprice &&
      matchesErrors
    );
  });
  const totalListings = filteredListings.length;

  const autoRepriceEnabled = filteredListings.filter(
    (l) => l.auto_reprice_enabled,
  ).length;

  const failedListings = filteredListings.filter(
    (l) => l.sync_status === "failed",
  ).length;

  const needsSyncListings = filteredListings.filter(
    (l) => l.sync_status === "needs_sync",
  ).length;

  return (
    <div className="section marketplace-listings-v2">
      <div className="listings-header-v2">
        <div>
          <h2>Marketplace Listings</h2>
          <p>
            Controlla prezzi, stato sincronizzazione, auto repricing e listing
            pubblicati sui marketplace.
          </p>
        </div>
        <div className="listings-count-badge">
          {filteredListings.length} results
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="marketplace-kpi-row">
        <div className="marketplace-kpi">
          <span>Listings</span>
          <strong>{totalListings}</strong>
        </div>

        <div className="marketplace-kpi">
          <span>Auto Reprice ON</span>
          <strong>{autoRepriceEnabled}</strong>
        </div>

        <div className="marketplace-kpi warning">
          <span>Needs Sync</span>
          <strong>{needsSyncListings}</strong>
        </div>

        <div className="marketplace-kpi danger">
          <span>Failed</span>
          <strong>{failedListings}</strong>
        </div>
      </div>

      <div className="filters-row marketplace-filters-v2">
        <input
          type="text"
          placeholder="Cerca ID, evento, categoria, remote listing..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          value={marketplaceFilter}
          onChange={(e) => setMarketplaceFilter(e.target.value)}
        >
          <option value="all">Tutti i marketplace</option>
          <option value="gigsberg">Gigsberg</option>
          <option value="ticombo">Ticombo</option>
          <option value="sportevents365">SportEvents365</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tutti gli status</option>
          <option value="synced">Synced</option>
          <option value="needs_sync">Needs Sync</option>
          <option value="failed">Failed</option>
          <option value="deleted">Deleted</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={autoRepriceFilter}
          onChange={(e) => setAutoRepriceFilter(e.target.value)}
        >
          <option value="all">Auto Reprice: tutti</option>
          <option value="on">Auto Reprice ON</option>
          <option value="off">Auto Reprice OFF</option>
        </select>

        <label className="errors-only-toggle">
          <input
            type="checkbox"
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
          />
          Solo errori
        </label>
      </div>

      {filteredListings.length === 0 ? (
        <p>Nessun marketplace listing presente.</p>
      ) : (
        <div className="marketplace-listings-scroll">
          <table className="tickets-table marketplace-listings-table-v2">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Event</th>
                <th>Ticket</th>
                <th>Pricing</th>
                <th>Protection</th>
                <th>Reprice</th>
                <th>Sync</th>
                <th>Remote</th>
                <th>Error</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredListings.map((listing) => {
                const pricingStatus = getPricingStatus(listing);

                return (
                  <tr
                    key={listing.id}
                    className={`listing-row-${pricingStatus.className}`}
                  >
                    <td>
                      <div className="listing-main-cell">
                        <strong>#{listing.id}</strong>
                        <span>{safeText(listing.marketplace)}</span>
                      </div>
                    </td>

                    <td>
                      <div className="listing-event-cell">
                        <strong>{safeText(listing.event_name)}</strong>
                        <span>
                          {listing.event_date
                            ? new Date(listing.event_date).toLocaleString()
                            : "-"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="listing-ticket-cell">
                        <strong>{safeText(listing.category)}</strong>
                        <span>Block: {safeText(listing.block)}</span>
                        <span>Qty: {listing.available_quantity ?? "-"}</span>
                      </div>
                    </td>

                    <td>
                      <div className="pricing-stack">
                        <div>
                          <span>Partner</span>
                          <strong>
                            {safeNumber(
                              listing.partner_price || listing.base_price,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Marketplace</span>
                          <strong>
                            {safeNumber(
                              listing.marketplace_price ||
                                listing.ticket_marketplace_price ||
                                listing.base_price,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>Market</span>
                          <strong>
                            {safeNumber(listing.last_market_price)}
                          </strong>
                        </div>
                        <div>
                          <span>Suggested</span>
                          <strong>
                            {safeNumber(
                              listing.suggested_marketplace_price ||
                                listing.last_suggested_price,
                            )}
                          </strong>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="protection-cell">
                        <span
                          className={`status-pill ${pricingStatus.className}`}
                        >
                          {pricingStatus.label}
                        </span>
                        <small>Min: {safeNumber(listing.min_price)}</small>
                      </div>
                    </td>

                    <td>
                      <div className="reprice-cell">
                        <span
                          className={
                            listing.auto_reprice_enabled
                              ? "status-pill success"
                              : "status-pill neutral"
                          }
                        >
                          {listing.auto_reprice_enabled ? "ON" : "OFF"}
                        </span>
                        <small>
                          Undercut:{" "}
                          {safeNumber(listing.undercut_amount || 0.01)}
                        </small>
                      </div>
                    </td>

                    <td>
                      <div className="sync-cell">
                        <span
                          className={getSyncStatusBadgeClass(
                            listing.sync_status,
                          )}
                        >
                          {safeText(listing.sync_status).toUpperCase()}
                        </span>
                        <small>Retry: {listing.retry_count ?? 0}</small>
                        {listing.next_retry_at && (
                          <small>
                            Next:{" "}
                            {new Date(listing.next_retry_at).toLocaleString()}
                          </small>
                        )}
                        {listing.circuit_breaker_until && (
                          <small>
                            CB:{" "}
                            {new Date(
                              listing.circuit_breaker_until,
                            ).toLocaleString()}
                          </small>
                        )}
                      </div>
                    </td>

                    <td>
                      {safeText(
                        listing.remote_listing_id ||
                          listing.external_listing_id,
                      )}
                    </td>

                    <td title={safeText(listing.last_error)}>
                      <span
                        className={
                          listing.last_error
                            ? "listing-error-text has-error"
                            : "listing-error-text"
                        }
                      >
                        {listing.last_error
                          ? safeText(listing.last_error).slice(0, 60)
                          : "-"}
                      </span>
                    </td>

                    <td>
                      <div className="marketplace-actions">
                        {["failed", "needs_sync"].includes(
                          listing.sync_status,
                        ) && (
                          <button
                            className="marketplace-action-btn marketplace-retry-btn"
                            onClick={() => retrySync(listing.id)}
                          >
                            ↻ Retry
                          </button>
                        )}

                        <button
                          className="marketplace-action-btn marketplace-retry-btn"
                          onClick={() => runRepricing(listing.id)}
                        >
                          💶 Reprice
                        </button>

                        {canUnpublish(listing) && (
                          <button
                            className="marketplace-action-btn marketplace-delist-btn"
                            onClick={() => unpublishListing(listing)}
                          >
                            ⛔ Delist
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MarketplaceListingsTable;
