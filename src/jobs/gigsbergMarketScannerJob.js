const cron = require("node-cron");
const pool = require("../db");
const { calculateSafePrice } = require("../services/priceCheckerService");

const {
  searchListings,
} = require("../services/integrations/gigsberg/gigsbergApi");

const {
  getGigsbergMarketDataHtml,
  parseMarketPricesFromHtml,
} = require("../services/integrations/gigsberg/gigsbergMarketData");

const {
  getVisibleLowestPublicPrice,
} = require("../services/integrations/gigsberg/gigsbergPublicBrowserMarket");

function extractItems(result) {
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result)) return result;
  return [];
}
async function getGigsbergMappingPublicUrl(eventId) {
  if (!eventId) return null;

  const result = await pool.query(
    `
    SELECT public_url
    FROM marketplace_mappings
    WHERE marketplace = 'gigsberg'
      AND mapping_type = 'event'
      AND internal_event_id = $1
      AND is_active = true
      AND public_url IS NOT NULL
      AND public_url <> ''
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [eventId],
  );

  return result.rows[0]?.public_url || null;
}

async function runGigsbergMarketScannerJob() {
  console.log("Gigsberg market scanner job started");

  try {
    const result = await pool.query(`
      SELECT
        ml.id AS marketplace_listing_id,
        ml.ticket_id,
        t.event_id AS internal_event_id,
        ml.remote_listing_id,
        ml.remote_event_id,
        ml.remote_category_id,
        ml.marketplace,
        t.category,
        t.marketplace_price,
        t.min_price,
        t.undercut_amount,
        t.last_market_price
      FROM marketplace_listings ml
      JOIN tickets t ON t.id = ml.ticket_id
      WHERE ml.marketplace = 'gigsberg'
        AND ml.sync_status = 'synced'
    `);

    const listings = result.rows;
    console.log(`Gigsberg scanner listings found: ${listings.length}`);

    for (const listing of listings) {
      try {
        console.log(
          "Scanning Gigsberg listing:",
          listing.marketplace_listing_id,
        );

        const remoteListingId = Number(listing.remote_listing_id);

        if (!remoteListingId) continue;

        if (!listing.remote_event_id || !listing.remote_category_id) {
          console.log(
            "Skipping Gigsberg listing: missing remote_event_id or remote_category_id",
            listing.marketplace_listing_id,
          );
          continue;
        }
        console.log("Gigsberg search params:", {
          marketplace_listing_id: listing.marketplace_listing_id,

          remote_listing_id: listing.remote_listing_id,

          event_id: listing.remote_event_id,

          category_id: listing.remote_category_id,
        });
        const mappedPublicUrl = await getGigsbergMappingPublicUrl(
          listing.internal_event_id,
        );

        const publicUrl = mappedPublicUrl;

        if (!publicUrl) {
          console.log(
            "Gigsberg public URL missing from mapping, skipping scan",
            {
              marketplace_listing_id: listing.marketplace_listing_id,
              internal_event_id: listing.internal_event_id,
              remote_event_id: listing.remote_event_id,
            },
          );
          continue;
        }

        console.log("Gigsberg public URL:", publicUrl);

        let activeListings = [];

        try {
          const ownPublicPrice = Number(listing.marketplace_price || 0);

          const publicMarket = await getVisibleLowestPublicPrice(publicUrl, {
            headless: true,

            ownPrice: ownPublicPrice,

            ownPriceTolerance: 5,

            categoryName: listing.category,
          });

          if (publicMarket?.min_price) {
            console.log("Gigsberg public market price found:", publicMarket);

            activeListings.push({
              id: "public-market",
              price: Number(publicMarket.min_price),
              active: 1,
              event_id: listing.remote_event_id,
              category_id: listing.remote_category_id,
            });
          }
        } catch (publicError) {
          console.error(
            "Gigsberg public market primary error:",
            publicError.response?.data || publicError.message,
          );
        }

        if (activeListings.length === 0) {
          let marketplaceResult = await searchListings({
            event_id: Number(listing.remote_event_id),
            category_id: Number(listing.remote_category_id),
            page: 1,
            per_page: 50,
          });
          const normalizedCategory = String(listing.category || "")
            .trim()
            .toLowerCase();

          const isSafeFloorCategory = [
            "floor",
            "prato",
            "standing",
            "general admission",
            "ga",
            "pitch",
            "parterre",
          ].includes(normalizedCategory);

          if (activeListings.length === 0 && isSafeFloorCategory) {
            console.log("Gigsberg safe floor fallback by event only", {
              marketplace_listing_id: listing.marketplace_listing_id,
              category: listing.category,
              event_id: listing.remote_event_id,
            });

            const fallbackResult = await searchListings({
              event_id: Number(listing.remote_event_id),
              page: 1,
              per_page: 50,
            });

            const fallbackItems = extractItems(fallbackResult);

            activeListings = fallbackItems.filter(
              (item) =>
                item.active === 1 &&
                Number(item.id) !== remoteListingId &&
                Number(item.price || 0) > 0,
            );
          }

          let items = extractItems(marketplaceResult);

          activeListings = items.filter(
            (item) => item.active === 1 && Number(item.id) !== remoteListingId,
          );
        }

        if (activeListings.length === 0) {
          const publicMarket = await getVisibleLowestPublicPrice(publicUrl, {
            headless: true,
            ownPrice: Number(listing.marketplace_price || 0),
            ownPriceTolerance: 5,
            categoryName: listing.category,
          });

          if (publicMarket?.min_price) {
            console.log("Gigsberg public market price found:", publicMarket);

            activeListings.push({
              id: "public-market",
              price: Number(publicMarket.min_price),
              active: 1,
              event_id: listing.remote_event_id,
              category_id: listing.remote_category_id,
            });
          } else {
            console.log("No competitor listings found");

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

            await pool.query(
              `
      UPDATE tickets
      SET
        last_market_price = NULL,
        suggested_marketplace_price = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
              [listing.ticket_id],
            );

            continue;
          }
        }

        if (activeListings.length === 0) {
          try {
            const publicMarket = await getVisibleLowestPublicPrice(publicUrl, {
              headless: true,

              ownPrice: Number(listing.marketplace_price || 0),

              ownPriceTolerance: 5,

              categoryName: listing.category,
            });

            if (publicMarket?.min_price) {
              console.log("Gigsberg public market price found:", publicMarket);

              activeListings.push({
                id: "public-market",
                price: Number(publicMarket.min_price),
                active: 1,
                event_id: listing.remote_event_id,
                category_id: listing.remote_category_id,
              });
            }
          } catch (publicError) {
            console.error(
              "Gigsberg public market fallback error:",
              publicError.response?.data || publicError.message,
            );
          }
        }

        console.log(
          "Gigsberg competitors found:",
          activeListings.map((item) => ({
            id: item.id,
            price: item.price,
            category_id: item.category_id,
            event_id: item.event_id,
            active: item.active,
          })),
        );

        if (activeListings.length === 0) {
          const publicMarket = await getVisibleLowestPublicPrice(publicUrl, {
            headless: true,
            ownPrice: Number(listing.marketplace_price || 0),
            ownPriceTolerance: 5,
            categoryName: listing.category,
          });

          if (publicMarket?.min_price) {
            console.log("Gigsberg public market price found:", publicMarket);

            activeListings.push({
              id: "public-market",
              price: Number(publicMarket.min_price),
              active: 1,
              event_id: listing.remote_event_id,
              category_id: listing.remote_category_id,
            });
          } else {
            console.log("No competitor listings found");

            //await pool.query(
            // `
            // UPDATE marketplace_listings
            // SET
            //last_market_price = NULL,
            // last_suggested_price = NULL,
            // updated_at = NOW()
            // WHERE id = $1
            // `,
            // [listing.marketplace_listing_id],
            // );

            // await pool.query(
            // `
            //UPDATE tickets
            // SET
            //last_market_price = NULL,
            // suggested_marketplace_price = NULL,
            // updated_at = NOW()
            // WHERE id = $1
            // `,
            // [listing.ticket_id],
            // );

            continue;
          }
        }

        const lowestPrice = Math.min(
          ...activeListings.map((item) => Number(item.price || 0)),
        );

        console.log("Lowest market price:", lowestPrice);

        const priceCheck = calculateSafePrice({
          currentPrice: Number(listing.marketplace_price || 0),

          marketLowestPrice: Number(lowestPrice || 0),

          minPrice: Number(listing.min_price || 0),

          undercutAmount: Number(listing.undercut_amount || 0.01),
        });

        const listingUpdateResult = await pool.query(
          `
          UPDATE marketplace_listings
          SET
            last_market_price = $1,
            last_suggested_price = $2,
            updated_at = NOW()
          WHERE id = $3
          RETURNING id, ticket_id, last_market_price, last_suggested_price
          `,
          [lowestPrice, priceCheck.finalPrice, listing.marketplace_listing_id],
        );

        console.log("GIGSBERG SCANNER MARKETPLACE_LISTING UPDATED", {
          target_id: listing.marketplace_listing_id,
          rowCount: listingUpdateResult.rowCount,
          row: listingUpdateResult.rows[0] || null,
        });

        await pool.query(
          `
          UPDATE tickets
          SET
            last_market_price = $1,
            suggested_marketplace_price = $2,
            updated_at = NOW()
          WHERE id = $3
          `,
          [lowestPrice, priceCheck.suggestedPrice, listing.ticket_id],
        );
      } catch (error) {
        console.error(
          "Errore scanner listing:",

          listing.marketplace_listing_id,
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
