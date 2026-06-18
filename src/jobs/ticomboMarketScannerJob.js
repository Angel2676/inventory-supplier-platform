const cron = require("node-cron");
const pool = require("../db");
const {
  getTicomboPublicMarketPrice,
} = require("../services/integrations/ticombo/ticomboPublicMarket");
const {
  getTicomboLowestMarketPrice,
} = require("../services/integrations/ticombo/ticomboMarketScanner");
const { calculateSafePrice } = require("../services/priceCheckerService");

async function runTicomboMarketScannerJob(options = {}) {
  const eventId = options.eventId ? Number(options.eventId) : null;

  console.log("Ticombo market scanner job started", { eventId });

  const queryParams = [];
  let eventFilterSql = "";

  if (eventId) {
    queryParams.push(eventId);
    eventFilterSql = `AND t.event_id = $${queryParams.length}`;
  }

  const result = await pool.query(
    `
    SELECT
      ml.id AS marketplace_listing_id,
      ml.ticket_id,
      ml.marketplace,
      ml.remote_event_id,
      ml.remote_listing_id,
      ml.public_url,
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
      ${eventFilterSql}
    ORDER BY ml.id DESC
  `,
    queryParams,
  );

  for (const listing of result.rows) {
    try {
      let marketPrice = null;
      let source = "none";

      if (!listing.public_url) {
        console.log("Ticombo scanner: missing public_url", {
          listing_id: listing.marketplace_listing_id,
          ticket_id: listing.ticket_id,
          event_id: listing.remote_event_id,
        });
      }

      const TICOMBO_PUBLIC_TO_SELLER_RATE = Number(
        process.env.TICOMBO_PUBLIC_TO_SELLER_RATE || 1.304,
      );

      const sellerCurrentPrice = Number(listing.marketplace_price || 0);

      const ownPublicPrice = Number(
        (sellerCurrentPrice * TICOMBO_PUBLIC_TO_SELLER_RATE).toFixed(2),
      );

      if (listing.public_url) {
        try {
          const market = await getTicomboPublicMarketPrice({
            publicUrl: listing.public_url,
            category: listing.category,
            block: listing.block,
            ownPublicPrice,
            headless: true,
          });

          marketPrice = market.lowestPrice;
          if (marketPrice) {
            source = "public_browser";
          }
        } catch (publicError) {
          console.error("Ticombo public scanner error, trying API fallback:", {
            listing_id: listing.marketplace_listing_id,
            ticket_id: listing.ticket_id,
            event_id: listing.remote_event_id,
            error: publicError.response?.data || publicError.message,
          });
        }
      }

      if (!marketPrice) {
        const fallbackMarket = await getTicomboLowestMarketPrice({
          remoteEventId: listing.remote_event_id,
          category: listing.category,
          block: listing.block,
          quantity: Number(listing.available_quantity || 1),
          excludeListingId: listing.remote_listing_id,
        });

        marketPrice = fallbackMarket.lowestPrice;
        if (marketPrice) {
          source = "api_fallback";
        }
      }

      if (!marketPrice) {
        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            last_market_price = $1,
            last_suggested_price = $2,
            updated_at = NOW()
          WHERE id = $3
          `,
          [null, null, listing.marketplace_listing_id],
        );

        console.log("Ticombo scanner: no competitor price", {
          listing_id: listing.marketplace_listing_id,
          ticket_id: listing.ticket_id,
          event_id: listing.remote_event_id,
          source,
        });

        continue;
      }

      const sellerMinPrice = Number(listing.min_price || 0);

      const publicCurrentPrice = Number(
        (sellerCurrentPrice * TICOMBO_PUBLIC_TO_SELLER_RATE).toFixed(2),
      );

      const publicMinPrice = Number(
        (sellerMinPrice * TICOMBO_PUBLIC_TO_SELLER_RATE).toFixed(2),
      );

      const priceCheck = calculateSafePrice({
        currentPrice: publicCurrentPrice,
        marketLowestPrice: Number(marketPrice),
        minPrice: publicMinPrice,
        undercutAmount: 1,
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
        [marketPrice, priceCheck.finalPrice, listing.marketplace_listing_id],
      );

      console.log("Ticombo scanner updated listing", {
        listing_id: listing.marketplace_listing_id,
        ticket_id: listing.ticket_id,
        source,
        marketPrice,
        suggestedPrice: priceCheck.finalPrice,
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
function startTicomboMarketScannerJob() {
  cron.schedule("30 */2 * * *", async () => {
    try {
      await runTicomboMarketScannerJob();
    } catch (error) {
      console.error("Ticombo market scanner scheduled job error:", error);
    }
  });

  console.log(
    "Ticombo market scanner job scheduled every 2 hours at minute 30",
  );
}

module.exports = {
  runTicomboMarketScannerJob,
  startTicomboMarketScannerJob,
};
