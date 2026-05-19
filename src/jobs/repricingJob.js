const cron = require("node-cron");
const pool = require("../db");
const { calculateSafePrice } = require("../services/priceCheckerService");

async function runRepricingJob() {
  console.log("Marketplace repricing job started");

  const listingsResult = await pool.query(`
    SELECT
      ml.*,
      t.status AS ticket_status,
      t.available_quantity,
      t.price AS base_price,
      t.partner_price
    FROM marketplace_listings ml
    JOIN tickets t ON t.id = ml.ticket_id
    WHERE ml.auto_reprice_enabled = true
      AND t.status = 'available'
      AND t.available_quantity > 0
      AND ml.sync_status IN ('active', 'pending', 'failed')
  `);

  const listings = listingsResult.rows;

  for (const listing of listings) {
    try {
      const currentMarketplacePrice = Number(
        listing.marketplace_price || listing.base_price || 0,
      );

      const marketLowestPrice = Number(listing.last_market_price || 0);

      const priceCheck = calculateSafePrice({
        currentPrice: currentMarketplacePrice,
        marketLowestPrice,
        minPrice: Number(listing.min_price),
        undercutAmount: Number(listing.undercut_amount || 0.01),
      });

      if (!priceCheck.shouldUpdate) {
        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            last_suggested_price = $1,
            last_reprice_at = NOW()
          WHERE id = $2
          `,
          [priceCheck.suggestedPrice, listing.id],
        );

        console.log(
          `Marketplace listing ${listing.id} (${listing.marketplace}): no update - ${priceCheck.reason}`,
        );

        continue;
      }

      await pool.query(
        `
        UPDATE marketplace_listings
        SET
          marketplace_price = $1,
          last_suggested_price = $2,
          last_reprice_at = NOW()
        WHERE id = $3
        `,
        [priceCheck.finalPrice, priceCheck.suggestedPrice, listing.id],
      );

      console.log(
        `Marketplace listing ${listing.id} (${listing.marketplace}): price updated from ${currentMarketplacePrice} to ${priceCheck.finalPrice}`,
      );
    } catch (error) {
      console.error(
        `Marketplace listing ${listing.id} (${listing.marketplace}): repricing error`,
        error.message,
      );
    }
  }

  console.log("Marketplace repricing job completed");
}

function startRepricingJob() {
  cron.schedule("*/10 * * * *", async () => {
    await runRepricingJob();
  });

  console.log("Automatic marketplace repricing job scheduled every 10 minutes");
}

module.exports = {
  runRepricingJob,
  startRepricingJob,
};
