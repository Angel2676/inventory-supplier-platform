const cron = require("node-cron");
const pool = require("../db");
const { calculateSafePrice } = require("../services/priceCheckerService");

const {
  updateListing: updateGigsbergListing,
} = require("../services/integrations/gigsberg/gigsbergApi");

const {
  updateTicomboListing,
} = require("../services/integrations/ticombo/ticomboListings");
const {
  getTicomboLowestMarketPrice,
} = require("../services/integrations/ticombo/ticomboMarketScanner");

async function runRepricingJob() {
  console.log("Marketplace repricing job started");

  const listingsResult = await pool.query(`
    SELECT
      ml.*,
      t.status AS ticket_status,
      t.available_quantity,
      t.category AS ticket_category,
      t.block AS ticket_block,
      t.price AS base_price,
      t.partner_price,
      t.marketplace_price AS ticket_marketplace_price,
      t.min_price AS ticket_min_price,
      t.undercut_amount AS ticket_undercut_amount,
      t.last_market_price AS ticket_last_market_price,
      t.suggested_marketplace_price AS ticket_suggested_marketplace_price,
      t.auto_reprice_enabled AS ticket_auto_reprice_enabled,
      ms.default_min_price AS marketplace_default_min_price
    FROM marketplace_listings ml
    JOIN tickets t ON t.id = ml.ticket_id
    JOIN marketplace_settings ms ON ms.marketplace = ml.marketplace
    WHERE COALESCE(ml.auto_reprice_enabled, t.auto_reprice_enabled) = true
      AND t.status = 'available'
      AND t.available_quantity > 0
      AND ml.sync_status = 'synced'
      AND ms.enabled = true
      AND ms.api_configured = true
  `);

  const listings = listingsResult.rows;

  const GIGSBERG_PROCEEDS_RATE = Number(
    process.env.GIGSBERG_PROCEEDS_RATE || 0.909,
  );

  function grossPriceFromProceeds(proceeds) {
    const value = Number(proceeds || 0);

    if (!value || value <= 0) return value;

    return Number((value / GIGSBERG_PROCEEDS_RATE).toFixed(2));
  }

  for (const listing of listings) {
    try {
      const currentMarketplacePrice = Number(
        listing.marketplace_price ||
          listing.ticket_marketplace_price ||
          listing.base_price ||
          0,
      );

      let marketLowestPrice = Number(
        listing.last_market_price || listing.ticket_last_market_price || 0,
      );

      if (listing.marketplace === "ticombo") {
        const ticomboMarket = await getTicomboLowestMarketPrice({
          remoteEventId: listing.remote_event_id,
          category: listing.ticket_category,
          block: listing.ticket_block,
          quantity: Number(listing.available_quantity || 1),
          excludeListingId: listing.remote_listing_id,
        });

        if (ticomboMarket.lowestPrice) {
          marketLowestPrice = Number(ticomboMarket.lowestPrice);

          console.log("Ticombo market price detected:", {
            listing_id: listing.id,
            remote_event_id: listing.remote_event_id,
            category: listing.ticket_category,
            block: listing.ticket_block,
            lowestPrice: ticomboMarket.lowestPrice,
            competitorListingId: ticomboMarket.competitorListingId,
            matchedCount: ticomboMarket.matchedCount,
          });
        }
      }

      const priceCheck = calculateSafePrice({
        currentPrice: currentMarketplacePrice,
        marketLowestPrice,
        minPrice: Number(
          listing.min_price ||
            listing.ticket_min_price ||
            listing.marketplace_default_min_price ||
            0,
        ),
        undercutAmount: Number(
          listing.undercut_amount || listing.ticket_undercut_amount || 0.01,
        ),
      });

      const effectiveMinPrice = Number(
        listing.min_price ||
          listing.ticket_min_price ||
          listing.marketplace_default_min_price ||
          0,
      );

      const safeLastMarketPrice = marketLowestPrice || null;
      const safeLastSuggestedPrice =
        safeLastMarketPrice === null ? null : priceCheck.finalPrice;

      if (!priceCheck.shouldUpdate) {
        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            last_market_price = $1,
            last_suggested_price = $2,
            last_reprice_at = NOW(),
            updated_at = NOW()
          WHERE id = $3
          `,
          [safeLastMarketPrice, safeLastSuggestedPrice, listing.id],
        );
        console.log("GIGSBERG SCANNER TICKET UPDATED", {
          ticket_id: listing.ticket_id,
        });

        console.log(
          `Marketplace listing ${listing.id} (${listing.marketplace}): no update - ${priceCheck.reason}`,
        );

        continue;
      }

      if (listing.marketplace === "gigsberg" && listing.remote_listing_id) {
        if (
          effectiveMinPrice > 0 &&
          Number(priceCheck.finalPrice) < effectiveMinPrice
        ) {
          console.error("BLOCKED_REPRICE_BELOW_MIN_PRICE", {
            listing_id: listing.id,
            marketplace: listing.marketplace,
            finalPrice: priceCheck.finalPrice,
            effectiveMinPrice,
            priceCheck,
          });

          continue;
        }
        console.log(
          `Updating Gigsberg listing ${listing.remote_listing_id}: new price ${priceCheck.finalPrice}`,
        );

        const gigsbergPublicPrice = priceCheck.finalPrice;

        console.log("Gigsberg public price repricing:", {
          listing_id: listing.id,
          remote_listing_id: listing.remote_listing_id,
          public_price_sent_to_gigsberg: gigsbergPublicPrice,
          competitor_price: marketLowestPrice,
          undercut_amount:
            listing.undercut_amount || listing.ticket_undercut_amount || 0.01,
        });

        await updateGigsbergListing(listing.remote_listing_id, {
          price: gigsbergPublicPrice,
          quantity: Number(listing.available_quantity),
          presented_quantity: Number(listing.available_quantity),
        });

        console.log(
          `Gigsberg listing ${listing.remote_listing_id} updated successfully`,
        );
      }
      if (listing.marketplace === "ticombo" && listing.remote_listing_id) {
        if (
          effectiveMinPrice > 0 &&
          Number(priceCheck.finalPrice) < effectiveMinPrice
        ) {
          console.error("BLOCKED_REPRICE_BELOW_MIN_PRICE", {
            listing_id: listing.id,
            marketplace: listing.marketplace,
            finalPrice: priceCheck.finalPrice,
            effectiveMinPrice,
            priceCheck,
          });

          continue;
        }

        console.log(
          `Updating Ticombo listing ${listing.remote_listing_id}: new price ${priceCheck.finalPrice}`,
        );

        await updateTicomboListing(listing.remote_listing_id, {
          price: priceCheck.finalPrice,
        });

        console.log(
          `Ticombo listing ${listing.remote_listing_id} updated successfully`,
        );
      }
      console.log("REPRICING DB UPDATE INPUT", {
        listing_id: listing.id,
        marketplace: listing.marketplace,
        marketplace_price: priceCheck.finalPrice,
        last_market_price:
          marketLowestPrice || listing.last_market_price || null,
        last_suggested_price: priceCheck.finalPrice,
      });

      await pool.query(
        `
        UPDATE marketplace_listings
        SET
          marketplace_price = $1,
          last_market_price = $2,
          last_suggested_price = $3,
          last_reprice_at = NOW(),
          updated_at = NOW()
        WHERE id = $4
        `,
        [
          priceCheck.finalPrice,
          marketLowestPrice || listing.last_market_price || null,
          priceCheck.finalPrice,
          listing.id,
        ],
      );

      // await pool.query(
      //`
      // UPDATE tickets
      //SET
      // marketplace_price = $1,
      // updated_at = NOW()
      //WHERE id = $2
      //`,
      // [priceCheck.finalPrice, listing.ticket_id],
      //);

      console.log(
        `Marketplace listing ${listing.id} (${listing.marketplace}): price updated from ${currentMarketplacePrice} to ${priceCheck.finalPrice}`,
      );
    } catch (error) {
      console.error("REPRICING FULL ERROR", {
        listing_id: listing.id,
        marketplace: listing.marketplace,
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        where: error.where,
        routine: error.routine,
        stack: error.stack,
        response: error.response?.data,
      });
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
