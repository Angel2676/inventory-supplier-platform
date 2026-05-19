import TicketsTable from "./TicketsTable";

function MarketplaceHub() {
  return (
    <div className="section">
      <h2>Marketplace Hub</h2>
      <p>
        Gestione prezzi marketplace, repricing automatico, publish e
        sincronizzazione multi-marketplace.
      </p>

      <TicketsTable canEdit={true} marketplaceMode={true} />
    </div>
  );
}

export default MarketplaceHub;
