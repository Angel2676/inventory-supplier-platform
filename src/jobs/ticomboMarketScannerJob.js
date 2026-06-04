const pool = require("../db");
const {
  getTicomboPublicEventListings,
} = require("../services/integrations/ticombo/ticomboPublicMarketApi");
const { calculateSafePrice } = require("../services/priceCheckerService");

async function runTicomboMarketScannerJob() {
  console.log("Ticombo market scanner job started");

  const result = await pool.query(`
    SELECT
      ml.id AS marketplace_listing_id,
      ml.ticket_id,
      ml.marketplace,
      ml.remote_event_id,
      ml.remote_listing_id,
      ml.marketplace_price,
      ml.min_price,
      ml.undercut_amount,
      t.available_quantity,
      t.category,
      t.block
    FROM marketplace_listings ml
    JOIN tickets t ON t.id = ml.ticket_id
    JOIN marketplace_settings ms ON ms.marketplace = ml.marketplace
    WHERE ml.marketplace = 'ticombo'
      AND ml.sync_status = 'synced'
      AND ml.remote_event_id IS NOT NULL
      AND ms.enabled = true
      AND ms.api_configured = true
    ORDER BY ml.id DESC
  `);

  for (const listing of result.rows) {
    try {
      const market = await getTicomboPublicEventListings(
        listing.remote_event_id,
        { quantity: Math.max(Number(listing.available_quantity || 2), 2) },
      );

      const marketPrice = market.lowestCompetitorPrice;

      if (!marketPrice) {
        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            last_market_price = NULL,
            last_suggested_price = NULL,
            updated_at = NOW()
          WHERE id = $1
          `,
          [listing.marketplace_listing_id],
        );

        console.log("Ticombo scanner: no competitor price", {
          listing_id: listing.marketplace_listing_id,
          ticket_id: listing.ticket_id,
          event_id: listing.remote_event_id,
        });

        continue;
      }

      const priceCheck = calculateSafePrice({
        currentPrice: Number(listing.marketplace_price || 0),
        marketLowestPrice: Number(marketPrice),
        minPrice: Number(listing.min_price || 0),
        undercutAmount: Number(listing.undercut_amount || 0.01),
      });

      await pool.query(
        `
        UPDATE marketplace_listings
        SET
          last_market_price = $1,
          last_suggested_price = $2,
          updated_at = NOW()
        WHERE id = $3
        `,
        [
          marketPrice,
          priceCheck.suggestedPrice,
          listing.marketplace_listing_id,
        ],
      );

      console.log("Ticombo scanner updated listing", {
        listing_id: listing.marketplace_listing_id,
        ticket_id: listing.ticket_id,
        marketPrice,
        suggestedPrice: priceCheck.suggestedPrice,
      });
    } catch (error) {
      console.error("Ticombo scanner error:", {
        listing_id: listing.marketplace_listing_id,
        ticket_id: listing.ticket_id,
        error: error.response?.data || error.message,
      });
    }
  }

  console.log(`Ticombo market scanner completed: ${result.rows.length}`);
}

module.exports = {
  runTicomboMarketScannerJob,
};
