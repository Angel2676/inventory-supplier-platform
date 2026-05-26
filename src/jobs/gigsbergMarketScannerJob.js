const cron = require("node-cron");
const pool = require("../db");

const {
  searchListings,
} = require("../services/integrations/gigsberg/gigsbergApi");

function extractItems(result) {
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result)) return result;
  return [];
}

async function runGigsbergMarketScannerJob() {
  console.log("Gigsberg market scanner job started");

  try {
    const result = await pool.query(`
      SELECT
        ml.id AS marketplace_listing_id,
        ml.ticket_id,
        ml.remote_listing_id,
        ml.marketplace,
        t.category,
        t.last_market_price
      FROM marketplace_listings ml
      JOIN tickets t ON t.id = ml.ticket_id
      WHERE ml.marketplace = 'gigsberg'
        AND ml.sync_status = 'synced'
    `);

    const listings = result.rows;

    for (const listing of listings) {
      try {
        console.log("Scanning listing:", listing.id);

        const remoteListingId = Number(listing.remote_listing_id);

        if (!remoteListingId) continue;

        const marketplaceResult = await searchListings({
          page: 1,
          per_page: 50,
        });

        const items = extractItems(marketplaceResult);

        const activeListings = items.filter(
          (item) => item.active === 1 && Number(item.id) !== remoteListingId,
        );

        if (activeListings.length === 0) {
          console.log("No competitor listings found");
          continue;
        }

        const lowestPrice = Math.min(
          ...activeListings.map((item) => Number(item.price || 0)),
        );

        console.log("Lowest market price:", lowestPrice);

        await pool.query(
          `
          UPDATE tickets
          SET
            last_market_price = $1,
            updated_at = NOW()
          WHERE id = $2
          `,
          [lowestPrice, listing.ticket_id],
        );
      } catch (error) {
        console.error(
          "Errore scanner listing:",
          listing.id,
          error.response?.data || error.message,
        );
      }
    }

    console.log("Gigsberg market scanner completed");
  } catch (error) {
    console.error("Errore Gigsberg market scanner:", error.message);
  }
}

cron.schedule("*/10 * * * *", async () => {
  await runGigsbergMarketScannerJob();
});

module.exports = {
  runGigsbergMarketScannerJob,
};
