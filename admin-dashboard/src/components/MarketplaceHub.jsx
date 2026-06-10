import { useEffect, useState } from "react";
import api from "../api";
import CollapsibleSection from "./CollapsibleSection";
// import MarketplaceSettingsTable from "./MarketplaceSettingsTable";
import MarketplaceMappingsTable from "./MarketplaceMappingsTable";
import MarketplaceOrdersTable from "./MarketplaceOrdersTable";
import MarketplaceListingsTable from "./MarketplaceListingsTable";
import MarketplaceLogsTable from "./MarketplaceLogsTable";
import TicketsTable from "./TicketsTable";
// import MarketplaceContentRequestsTable from "./MarketplaceContentRequestsTable";
import MarketplaceEventSearch from "./MarketplaceEventSearch";
import TicomboCatalogUpload from "./TicomboCatalogUpload";

const marketplaceTabs = [
  { key: "overview", label: "Overview" },
  { key: "listings", label: "Listings" },
  { key: "orders", label: "Orders" },
  { key: "publish", label: "Publish" },
  { key: "admin", label: "Admin" },
];

function MarketplaceHub() {
  const [activeTab, setActiveTab] = useState("overview");
  const [listings, setListings] = useState([]);

  useEffect(() => {
    async function loadListingsOverview() {
      try {
        const response = await api.get("/api/marketplace/listings");
        setListings(response.data || []);
      } catch (err) {
        console.error("Errore caricamento marketplace overview", err);
      }
    }

    loadListingsOverview();
  }, []);

  const marketplaceOverview = ["gigsberg", "ticombo", "sportevents365"].map(
    (marketplace) => {
      const marketplaceListings = listings.filter(
        (listing) => listing.marketplace === marketplace,
      );

      return {
        marketplace,
        total: marketplaceListings.length,
        failed: marketplaceListings.filter((l) => l.sync_status === "failed")
          .length,
        needsSync: marketplaceListings.filter(
          (l) => l.sync_status === "needs_sync",
        ).length,
        autoReprice: marketplaceListings.filter((l) => l.auto_reprice_enabled)
          .length,
      };
    },
  );

  const totalFailed = listings.filter((l) => l.sync_status === "failed").length;
  const totalNeedsSync = listings.filter(
    (l) => l.sync_status === "needs_sync",
  ).length;
  const totalAutoReprice = listings.filter(
    (l) => l.auto_reprice_enabled,
  ).length;

  return (
    <div className="marketplace-center">
      <div className="marketplace-hero">
        <div>
          <span className="marketplace-eyebrow">Marketplace operations</span>
          <h2>Marketplace Center</h2>
          <p>
            Gestione operativa di listings, ordini, pubblicazioni, mapping,
            cataloghi, logs e sincronizzazioni multi-marketplace.
          </p>
        </div>

        <div className="marketplace-hero-actions">
          <button type="button" onClick={() => setActiveTab("publish")}>
            + Publish
          </button>
          <button type="button" onClick={() => setActiveTab("listings")}>
            View Listings
          </button>
          <button type="button" onClick={() => setActiveTab("admin")}>
            Admin Tools
          </button>
        </div>
      </div>

      <div className="marketplace-kpi-grid">
        <button
          type="button"
          className="marketplace-kpi-card"
          onClick={() => setActiveTab("listings")}
        >
          <span>Listings</span>
          <strong>Live</strong>
          <small>Prezzi, status e sync</small>
        </button>

        <button
          type="button"
          className="marketplace-kpi-card"
          onClick={() => setActiveTab("orders")}
        >
          <span>Orders</span>
          <strong>Check</strong>
          <small>Ordini marketplace</small>
        </button>

        <button
          type="button"
          className="marketplace-kpi-card warning"
          onClick={() => setActiveTab("publish")}
        >
          <span>Publish</span>
          <strong>Ready</strong>
          <small>Nuove pubblicazioni</small>
        </button>

        <button
          type="button"
          className="marketplace-kpi-card"
          onClick={() => setActiveTab("admin")}
        >
          <span>Admin</span>
          <strong>Tools</strong>
          <small>Mappings, cataloghi e logs</small>
        </button>
      </div>

      <div className="marketplace-tabs">
        {marketplaceTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`marketplace-tab-panel ${activeTab === "publish" ? "publish-panel" : ""}`}
      >
        {activeTab === "overview" && (
          <div className="marketplace-overview-v2">
            <div className="marketplace-overview-summary">
              <div>
                <span>Total listings</span>
                <strong>{listings.length}</strong>
              </div>
              <div>
                <span>Auto Reprice ON</span>
                <strong>{totalAutoReprice}</strong>
              </div>
              <div className="warning">
                <span>Needs Sync</span>
                <strong>{totalNeedsSync}</strong>
              </div>
              <div className="danger">
                <span>Failed</span>
                <strong>{totalFailed}</strong>
              </div>
            </div>

            <div className="marketplace-overview-grid">
              <div className="marketplace-overview-card">
                <h3>Marketplace status</h3>
                <p>
                  Stato operativo sintetico dei marketplace collegati, basato
                  sui listing attualmente presenti nel sistema.
                </p>

                <div className="marketplace-health-list">
                  {marketplaceOverview.map((item) => (
                    <div
                      className="marketplace-health-row"
                      key={item.marketplace}
                    >
                      <div>
                        <strong>{item.marketplace}</strong>
                        <span>{item.total} listings</span>
                      </div>

                      <div className="marketplace-health-metrics">
                        <span>{item.autoReprice} reprice</span>
                        <span className={item.needsSync ? "warning" : ""}>
                          {item.needsSync} sync
                        </span>
                        <span className={item.failed ? "danger" : ""}>
                          {item.failed} failed
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="marketplace-overview-card">
                <h3>Quick actions</h3>
                <div className="marketplace-quick-actions">
                  <button type="button" onClick={() => setActiveTab("publish")}>
                    Publish new listing
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("listings")}
                  >
                    Review listings
                  </button>
                  <button type="button" onClick={() => setActiveTab("orders")}>
                    Check orders
                  </button>
                  <button type="button" onClick={() => setActiveTab("admin")}>
                    Open admin tools
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "listings" && (
          <div id="marketplace-listings">
            <MarketplaceListingsTable />
          </div>
        )}

        {activeTab === "orders" && <MarketplaceOrdersTable />}

        {activeTab === "publish" && (
          <div id="publish-marketplace-listing">
            <CollapsibleSection
              title="Publish New Marketplace Listing"
              description="Seleziona un ticket inventory e pubblicalo su Gigsberg, Ticombo o altri marketplace."
              defaultOpen={true}
            >
              <TicketsTable canEdit={true} marketplaceMode={true} />
            </CollapsibleSection>
          </div>
        )}

        {activeTab === "admin" && (
          <>
            <CollapsibleSection
              title="Marketplace Event Search"
              description="Cerca eventi remoti su Ticombo o altri marketplace per creare i mapping."
              defaultOpen={true}
            >
              <div id="marketplace-event-search">
                <MarketplaceEventSearch />
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Marketplace Mappings"
              description="Mappa eventi, categorie e blocchi interni verso gli ID dei marketplace."
              defaultOpen={false}
            >
              <MarketplaceMappingsTable />
            </CollapsibleSection>

            <CollapsibleSection
              title="Ticombo Catalog"
              description="Importa il catalogo eventi Ticombo da CSV per usare Event ID, slug, categorie e sezioni nel mapping e repricing."
              defaultOpen={false}
            >
              <TicomboCatalogUpload />
            </CollapsibleSection>

            <CollapsibleSection
              title="Marketplace Logs"
              description="Visualizza errori, retry, publish, sync quantity e risposte API."
              defaultOpen={false}
            >
              <MarketplaceLogsTable />
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
}

export default MarketplaceHub;
