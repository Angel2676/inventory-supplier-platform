import CollapsibleSection from "./CollapsibleSection";
// import MarketplaceSettingsTable from "./MarketplaceSettingsTable";
import MarketplaceMappingsTable from "./MarketplaceMappingsTable";
import MarketplaceOrdersTable from "./MarketplaceOrdersTable";
import MarketplaceListingsTable from "./MarketplaceListingsTable";
import MarketplaceLogsTable from "./MarketplaceLogsTable";
import TicketsTable from "./TicketsTable";
// import MarketplaceContentRequestsTable from "./MarketplaceContentRequestsTable";
import MarketplaceEventSearch from "./MarketplaceEventSearch";

function MarketplaceHub() {
  return (
    <>
      <div className="section">
        <h2>Marketplace Hub</h2>
        <p>
          Gestione listing marketplace, ordini, mappings, logs, prezzi separati,
          repricing, sync status e pubblicazione multi-marketplace.
        </p>
      </div>

      {/*
      <CollapsibleSection
        title="Marketplace Settings"
        description="Configura marketplace attivi, ambiente sandbox/production e default pricing."
        defaultOpen={true}
      >
        <MarketplaceSettingsTable />
      </CollapsibleSection>
        */}

      <CollapsibleSection
        title="Marketplace Mappings"
        description="Mappa eventi, categorie e blocchi interni verso gli ID dei marketplace."
        defaultOpen={true}
      >
        <CollapsibleSection
          title="Marketplace Event Search"
          description="Cerca eventi remoti su Ticombo o altri marketplace per creare i mapping."
          defaultOpen={true}
        >
          <MarketplaceEventSearch />
        </CollapsibleSection>
        <MarketplaceMappingsTable />

        {/*
        <CollapsibleSection
          title="Marketplace Content Requests"
          description="Track missing mappings, invalid marketplace eventIds and pending supplier content requests."
          defaultOpen={true}
        >
          <MarketplaceContentRequestsTable />
        </CollapsibleSection>
        */}
      </CollapsibleSection>

      <CollapsibleSection
        title="Marketplace Orders"
        description="Consulta e esporta gli ordini ricevuti dai marketplace."
        defaultOpen={false}
      >
        <MarketplaceOrdersTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="Marketplace Listings"
        description="Monitora listing pubblicati, prezzi marketplace, status e retry sync."
        defaultOpen={true}
      >
        <MarketplaceListingsTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="Marketplace Logs"
        description="Visualizza errori, retry, publish, sync quantity e risposte API."
        defaultOpen={false}
      >
        <MarketplaceLogsTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="Publish New Marketplace Listing"
        description="Seleziona un ticket inventory e pubblicalo su Gigsberg, Ticombo o altri marketplace."
        defaultOpen={true}
      >
        <TicketsTable canEdit={true} marketplaceMode={true} />
      </CollapsibleSection>
    </>
  );
}

export default MarketplaceHub;
