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
const {
  getTicomboPublicMarketPrice,
} = require("../services/integrations/ticombo/ticomboPublicMarket");

const {
  updateSupplierTicket,
} = require("../services/integrations/sportevents365/sportevents365Api");

const {
  getSportEvents365LowestMarketPrice,
} = require("../services/integrations/sportevents365/sportevents365MarketScanner");

async function runRepricingJob(options = {}) {
  const marketplaces = Array.isArray(options.marketplaces)
    ? options.marketplaces.filter(Boolean)
    : [];

  const eventId = options.eventId ? Number(options.eventId) : null;

  console.log("Marketplace repricing job started", {
    marketplaces: marketplaces.length ? marketplaces : "all",
    eventId,
  });

  const queryParams = [];
  let marketplaceFilterSql = "";
  let eventFilterSql = "";

  if (marketplaces.length > 0) {
    queryParams.push(marketplaces);
    marketplaceFilterSql = `AND ml.marketplace = ANY($${queryParams.length})`;
  }

  if (eventId) {
    queryParams.push(eventId);
    eventFilterSql = `AND t.event_id = $${queryParams.length}`;
  }

  const listingsResult = await pool.query(
    `
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
      ms.default_min_price AS marketplace_default_min_price,
      em.public_url AS event_public_url,
      cm.remote_category_name AS mapping_remote_category_name
    FROM marketplace_listings ml
    JOIN tickets t ON t.id = ml.ticket_id
    JOIN marketplace_settings ms ON ms.marketplace = ml.marketplace
    LEFT JOIN marketplace_mappings em
      ON em.marketplace = ml.marketplace
     AND em.mapping_type = 'event'
     AND em.internal_event_id = t.event_id
     AND em.is_active = true
     AND COALESCE(em.public_url, '') <> ''
    LEFT JOIN marketplace_mappings cm
      ON cm.marketplace = ml.marketplace
     AND cm.mapping_type IN ('category', 'category_block')
     AND cm.internal_event_id = t.event_id
     AND cm.internal_category = t.category
     AND COALESCE(cm.internal_block, '') = COALESCE(t.block, '')
     AND cm.is_active = true
    WHERE COALESCE(ml.auto_reprice_enabled, t.auto_reprice_enabled) = true
      AND t.status = 'available'
      AND t.available_quantity > 0
      AND ml.sync_status = 'synced'
      AND ms.enabled = true
      AND ms.api_configured = true
      ${marketplaceFilterSql}
      ${eventFilterSql}
  `,
    queryParams,
  );
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
      const TICOMBO_PUBLIC_TO_SELLER_RATE = Number(
        process.env.TICOMBO_PUBLIC_TO_SELLER_RATE || 1.3,
      );
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
        const ticomboPublicUrl = listing.public_url || listing.event_public_url;

        if (ticomboPublicUrl) {
          const ownPublicPrice =
            currentMarketplacePrice > 0
              ? Number(
                  (
                    currentMarketplacePrice * TICOMBO_PUBLIC_TO_SELLER_RATE
                  ).toFixed(2),
                )
              : null;

          const publicMarket = await getTicomboPublicMarketPrice({
            publicUrl: ticomboPublicUrl,
            category: listing.ticket_category,
            block: listing.ticket_block,
            ownPublicPrice,
            headless: true,
          });

          if (publicMarket.lowestPrice) {
            marketLowestPrice = Number(publicMarket.lowestPrice);

            console.log("Ticombo public market price detected:", {
              listing_id: listing.id,
              remote_event_id: listing.remote_event_id,
              category: listing.ticket_category,
              ownPublicPrice,
              lowestPrice: publicMarket.lowestPrice,
              prices: publicMarket.prices,
              matchedCount: publicMarket.matchedCount,
              source: "public_browser_primary",
            });
          }
        }

        if (!marketLowestPrice) {
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
              source: "api_fallback",
            });
          }
        }
      }

      if (listing.marketplace === "sportevents365") {
        const sportEvents365Market = await getSportEvents365LowestMarketPrice({
          remoteEventId: listing.remote_event_id,
          remoteCategoryName:
            listing.remote_category_name ||
            listing.mapping_remote_category_name ||
            listing.ticket_category,
        });

        if (sportEvents365Market.lowestPrice) {
          marketLowestPrice = Number(sportEvents365Market.lowestPrice);

          console.log("SportEvents365 market price detected:", {
            listing_id: listing.id,
            remote_event_id: listing.remote_event_id,
            remote_category_name: listing.remote_category_name,
            lowestPrice: sportEvents365Market.lowestPrice,
            prices: sportEvents365Market.prices,
            matchedCount: sportEvents365Market.matchedCount,
            source: sportEvents365Market.source,
          });
        }
      }

      const effectiveUndercutAmount =
        listing.marketplace === "ticombo"
          ? 1
          : Number(
              listing.undercut_amount || listing.ticket_undercut_amount || 0.01,
            );

      const rawMinPrice = Number(
        listing.min_price ||
          listing.ticket_min_price ||
          listing.marketplace_default_min_price ||
          0,
      );

      const effectiveMinPriceForCalculation =
        listing.marketplace === "ticombo"
          ? Number((rawMinPrice * TICOMBO_PUBLIC_TO_SELLER_RATE).toFixed(2))
          : rawMinPrice;

      let priceCheck;

      if (listing.marketplace === "ticombo") {
        if (!marketLowestPrice || marketLowestPrice <= 0) {
          priceCheck = {
            shouldUpdate: false,
            reason: "NO_MARKET_PRICE",
            finalPrice: currentMarketplacePrice,
          };
        } else {
          const publicMinPrice = effectiveMinPriceForCalculation;
          const targetPublicPrice = Math.max(
            Number((marketLowestPrice - effectiveUndercutAmount).toFixed(2)),
            publicMinPrice,
          );

          const currentPublicPrice = Number(
            (currentMarketplacePrice * TICOMBO_PUBLIC_TO_SELLER_RATE).toFixed(
              2,
            ),
          );

          const priceDifference = Math.abs(
            Number(targetPublicPrice) - Number(currentPublicPrice),
          );

          priceCheck = {
            shouldUpdate: priceDifference >= 0.01,
            reason:
              targetPublicPrice > currentPublicPrice
                ? "REPRICE_UP"
                : "REPRICE_DOWN",
            finalPrice: targetPublicPrice,
            currentPublicPrice,
            targetPublicPrice,
            priceDifference,
          };
        }
      } else {
        priceCheck = calculateSafePrice({
          currentPrice: currentMarketplacePrice,
          marketLowestPrice,
          minPrice: effectiveMinPriceForCalculation,
          undercutAmount: effectiveUndercutAmount,
        });

        if (listing.marketplace === "gigsberg") {
          console.log("GIGSBERG PRICECHECK RESULT", {
            listing_id: listing.id,
            remote_listing_id: listing.remote_listing_id,
            currentMarketplacePrice,
            marketLowestPrice,
            effectiveMinPriceForCalculation,
            effectiveUndercutAmount,
            shouldUpdate: priceCheck.shouldUpdate,
            reason: priceCheck.reason,
            finalPrice: priceCheck.finalPrice,
          });
        }
      }

      const effectiveMinPrice = Number(
        listing.min_price ||
          listing.ticket_min_price ||
          listing.marketplace_default_min_price ||
          0,
      );

      const safeLastMarketPrice = marketLowestPrice || null;
      const safeLastSuggestedPrice =
        safeLastMarketPrice === null ? null : priceCheck.finalPrice;
      if (listing.marketplace === "ticombo") {
        console.log("TICOMBO PRICECHECK RESULT", {
          listing_id: listing.id,
          currentMarketplacePrice,
          currentPublicPrice: priceCheck.currentPublicPrice,
          marketLowestPrice,
          effectiveMinPriceForCalculation,
          targetPublicPrice: priceCheck.targetPublicPrice,
          priceDifference: priceCheck.priceDifference,
          shouldUpdate: priceCheck.shouldUpdate,
          reason: priceCheck.reason,
          finalPrice: priceCheck.finalPrice,
        });
      }
      if (
        !priceCheck.shouldUpdate &&
        priceCheck.reason?.startsWith("REPRICE_")
      ) {
        console.error("INCONSISTENT_PRICECHECK_FORCE_UPDATE", {
          listing_id: listing.id,
          marketplace: listing.marketplace,
          priceCheck,
        });

        priceCheck.shouldUpdate = true;
      }

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
        console.log("REPRICING LISTING CHECKED", {
          marketplace: listing.marketplace,
          listing_id: listing.id,
          ticket_id: listing.ticket_id,
          reason: priceCheck.reason,
        });

        console.log(
          `Marketplace listing ${listing.id} (${listing.marketplace}): no update - ${priceCheck.reason}`,
        );

        continue;
      }
      let ticomboApiPrice = priceCheck.finalPrice;
      let sportEvents365ApiPrice = priceCheck.finalPrice;

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

        ticomboApiPrice = Number(
          (
            Number(priceCheck.finalPrice) / TICOMBO_PUBLIC_TO_SELLER_RATE
          ).toFixed(2),
        );

        console.log("Ticombo public target to seller price conversion:", {
          listing_id: listing.id,
          remote_listing_id: listing.remote_listing_id,
          target_public_price: priceCheck.finalPrice,
          seller_price_sent_to_ticombo: ticomboApiPrice,
          public_to_seller_rate: TICOMBO_PUBLIC_TO_SELLER_RATE,
        });

        await updateTicomboListing(listing.remote_listing_id, {
          price: ticomboApiPrice,
        });

        console.log(
          `Ticombo listing ${listing.remote_listing_id} updated successfully`,
        );
      }
      if (
        listing.marketplace === "sportevents365" &&
        listing.remote_listing_id
      ) {
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
          `Updating SportEvents365 listing ${listing.remote_listing_id}: new price ${priceCheck.finalPrice}`,
        );

        await updateSupplierTicket(
          listing.remote_event_id,
          listing.remote_listing_id,
          {
            price: Math.ceil(Number(priceCheck.finalPrice)),
          },
        );

        console.log(
          `SportEvents365 listing ${listing.remote_listing_id} updated successfully`,
        );
      }

      const dbMarketplacePrice =
        listing.marketplace === "ticombo"
          ? ticomboApiPrice
          : listing.marketplace === "sportevents365"
            ? sportEvents365ApiPrice
            : priceCheck.finalPrice;

      console.log("REPRICING DB UPDATE INPUT", {
        listing_id: listing.id,
        marketplace: listing.marketplace,
        marketplace_price: dbMarketplacePrice,
        target_public_price: priceCheck.finalPrice,
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
          dbMarketplacePrice,
          marketLowestPrice || listing.last_market_price || null,
          priceCheck.finalPrice,
          listing.id,
        ],
      );

      await pool.query(
        `
        UPDATE tickets
        SET
          marketplace_price = $1,
          last_market_price = $2,
          suggested_marketplace_price = $3,
          updated_at = NOW()
        WHERE id = $4
        `,
        [
          dbMarketplacePrice,
          marketLowestPrice || listing.last_market_price || null,
          priceCheck.finalPrice,
          listing.ticket_id,
        ],
      );

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
  // Gigsberg
  cron.schedule("15 */2 * * *", async () => {
    await runRepricingJob({
      marketplaces: ["gigsberg"],
    });
  });

  // Ticombo
  cron.schedule("45 */2 * * *", async () => {
    await runRepricingJob({
      marketplaces: ["ticombo"],
    });
  });

  // SportEvents365
  cron.schedule("15 1-23/2 * * *", async () => {
    await runRepricingJob({
      marketplaces: ["sportevents365"],
    });
  });

  console.log("Marketplace repricing jobs scheduled per marketplace");
}
module.exports = {
  runRepricingJob,
  startRepricingJob,
};
