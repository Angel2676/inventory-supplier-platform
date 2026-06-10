const pool = require("../db");

const {
  updateSupplierTicket,
} = require("./integrations/sportevents365/sportevents365Api");

const {
  updateTicomboListing,
  deleteTicomboListing,
} = require("./integrations/ticombo/ticomboListings");

const {
  updateListing: updateGigsbergListing,
  deleteListing: deleteGigsbergListing,
} = require("./integrations/gigsberg/gigsbergApi");

const {
  publishTicomboTicket,
} = require("./integrations/ticombo/ticomboPublishService");

/*
|--------------------------------------------------------------------------
| SPORTSEVENTS365 QUANTITY SYNC
|--------------------------------------------------------------------------
*/

async function updateSportEvents365Quantity(listing, quantity) {
  if (!listing.remote_event_id || !listing.remote_listing_id) {
    throw new Error(
      "remote_event_id o remote_listing_id mancanti per SportEvents365",
    );
  }

  const response = await updateSupplierTicket(
    listing.remote_event_id,
    listing.remote_listing_id,
    {
      quantity: Number(quantity),
    },
  );

  return {
    marketplace: "sportevents365",
    listing_id: listing.id,
    remote_event_id: listing.remote_event_id,
    remote_listing_id: listing.remote_listing_id,
    quantity: Number(quantity),
    response,
  };
}

/*
|--------------------------------------------------------------------------
| SPORTSEVENTS365 PRICE SYNC
|--------------------------------------------------------------------------
*/

async function updateSportEvents365Price(listing, price) {
  if (!listing.remote_event_id || !listing.remote_listing_id) {
    throw new Error(
      "remote_event_id o remote_listing_id mancanti per SportEvents365 price sync",
    );
  }

  const response = await updateSupplierTicket(
    listing.remote_event_id,
    listing.remote_listing_id,
    {
      price: Number(price),
    },
  );

  return {
    marketplace: "sportevents365",
    listing_id: listing.id,
    remote_event_id: listing.remote_event_id,
    remote_listing_id: listing.remote_listing_id,
    price: Number(price),
    response,
  };
}

/*
|--------------------------------------------------------------------------
| SPORTSEVENTS365 AUTO DELIST
|--------------------------------------------------------------------------
*/

async function autoDelistSportEvents365Listing(listing) {
  if (!listing.remote_event_id || !listing.remote_listing_id) {
    throw new Error(
      "remote_event_id o remote_listing_id mancanti per SportEvents365 delist",
    );
  }

  const response = await updateSupplierTicket(
    listing.remote_event_id,
    listing.remote_listing_id,
    {
      quantity: 0,
    },
  );

  return {
    marketplace: "sportevents365",
    action: "auto_delist_zero_quantity",
    listing_id: listing.id,
    remote_event_id: listing.remote_event_id,
    remote_listing_id: listing.remote_listing_id,
    quantity: 0,
    response,
  };
}

/*
|--------------------------------------------------------------------------
| TICOMBO QUANTITY + PRICE SYNC
|--------------------------------------------------------------------------
*/

async function updateTicomboQuantityAndPrice(listing, quantity, price) {
  if (!listing.remote_listing_id) {
    throw new Error("remote_listing_id mancante per Ticombo");
  }

  const payload = {};

  if (price !== undefined && price !== null) {
    payload.price = Number(price);
  }

  const response = await updateTicomboListing(
    listing.remote_listing_id,
    payload,
  );

  return {
    marketplace: "ticombo",
    action: "quantity_price_sync",
    listing_id: listing.id,
    remote_listing_id: listing.remote_listing_id,
    quantity: Number(quantity),
    price: price !== undefined && price !== null ? Number(price) : null,
    response,
  };
}

/*
|--------------------------------------------------------------------------
| TICOMBO AUTO DELIST
|--------------------------------------------------------------------------
*/

async function autoDelistTicomboListing(listing) {
  if (!listing.remote_listing_id) {
    throw new Error("remote_listing_id mancante per auto delist Ticombo");
  }

  const response = await deleteTicomboListing(listing.remote_listing_id);

  return {
    marketplace: "ticombo",
    action: "auto_delist_zero_quantity",
    listing_id: listing.id,
    remote_listing_id: listing.remote_listing_id,
    response,
  };
}

/*
|--------------------------------------------------------------------------
| TICOMBO AUTO REPUBLISH
|--------------------------------------------------------------------------
*/

async function autoRepublishTicomboListing(listing, quantity, price) {
  const publishResult = await publishTicomboTicket(listing.ticket_id);

  return {
    marketplace: "ticombo",
    action: "auto_republish_quantity_restored",
    listing_id: listing.id,
    previous_remote_listing_id: listing.remote_listing_id,
    new_remote_listing_id: publishResult.remoteListingId,
    quantity: Number(quantity),
    price: Number(price),
    publishResponse: publishResult.publishResponse,
    eventMapping: {
      remote_event_id: publishResult.eventMapping.remote_event_id,
      remote_event_name: publishResult.eventMapping.remote_event_name,
    },
    categoryMapping: {
      remote_category_id: publishResult.categoryMapping.remote_category_id,
      remote_category_name: publishResult.categoryMapping.remote_category_name,
    },
  };
}

/*
|--------------------------------------------------------------------------
| GIGSBERG AUTO DELIST
|--------------------------------------------------------------------------
*/

async function autoDelistGigsbergListing(listing) {
  if (!listing.remote_listing_id) {
    throw new Error("remote_listing_id mancante per auto delist Gigsberg");
  }

  const response = await deleteGigsbergListing(listing.remote_listing_id);

  return {
    marketplace: "gigsberg",
    action: "auto_delist_zero_quantity",
    listing_id: listing.id,
    remote_listing_id: listing.remote_listing_id,
    response,
  };
}

/*
|--------------------------------------------------------------------------
| GIGSBERG PLACEHOLDER
|--------------------------------------------------------------------------
*/
const GIGSBERG_PROCEEDS_RATE = Number(
  process.env.GIGSBERG_PROCEEDS_RATE || 0.909,
);

function grossPriceFromProceeds(proceeds) {
  const value = Number(proceeds || 0);

  if (!value || value <= 0) return value;

  return Number((value / GIGSBERG_PROCEEDS_RATE).toFixed(2));
}

async function updateGigsbergQuantityAndPrice(listing, quantity, price) {
  if (!listing.remote_listing_id) {
    throw new Error("remote_listing_id mancante per Gigsberg");
  }

  const payload = {
    quantity: Number(quantity),
    presented_quantity: Number(quantity),
  };

  let grossPrice = null;

  if (price !== undefined && price !== null) {
    grossPrice = grossPriceFromProceeds(price);
    payload.price = grossPrice;
  }

  console.log("Gigsberg update payload:", {
    listing_id: listing.id,
    remote_listing_id: listing.remote_listing_id,
    quantity: Number(quantity),
    target_proceeds:
      price !== undefined && price !== null ? Number(price) : null,
    gross_price_sent_to_gigsberg: grossPrice,
    proceeds_rate: GIGSBERG_PROCEEDS_RATE,
    payload,
  });

  const response = await updateGigsbergListing(
    listing.remote_listing_id,
    payload,
  );

  return {
    marketplace: "gigsberg",
    action: "quantity_price_sync",
    listing_id: listing.id,
    remote_listing_id: listing.remote_listing_id,
    quantity: Number(quantity),
    target_proceeds:
      price !== undefined && price !== null ? Number(price) : null,
    gross_price_sent_to_gigsberg: grossPrice,
    response,
  };
}

/*
|--------------------------------------------------------------------------
| ERROR NORMALIZER
|--------------------------------------------------------------------------
*/

function normalizeMarketplaceError(error) {
  if (error.response?.data) {
    try {
      return JSON.stringify(error.response.data);
    } catch (_) {
      return String(error.response.data);
    }
  }

  return error.message || "Errore sconosciuto marketplace sync";
}

/*
|--------------------------------------------------------------------------
| MAIN SYNC ENGINE
|--------------------------------------------------------------------------
*/

async function syncMarketplaceQuantities() {
  console.log("Marketplace quantity/price sync job started");

  try {
    const listingsResult = await pool.query(`
    SELECT
      ml.*,
      t.available_quantity,
      COALESCE(t.marketplace_price, t.partner_price, t.price) AS current_price
    FROM marketplace_listings ml
    JOIN tickets t
      ON t.id = ml.ticket_id
    JOIN marketplace_settings ms
      ON ms.marketplace = ml.marketplace
    WHERE ml.sync_status IN ('synced', 'needs_sync')
      AND ms.enabled = true
      AND ms.api_configured = true
      AND (
        ml.next_retry_at IS NULL
        OR ml.next_retry_at <= NOW()
      )
      AND (
        ml.circuit_breaker_until IS NULL
        OR ml.circuit_breaker_until <= NOW()
      )
  `);

    const listings = listingsResult.rows;

    for (const listing of listings) {
      try {
        const currentQuantity = Number(listing.available_quantity || 0);
        const currentPrice = Number(listing.current_price || 0);

        let responsePayload = null;
        /*
|--------------------------------------------------------------------------
| FIRST PUBLISH FOR NEEDS_SYNC WITHOUT REMOTE LISTING
|--------------------------------------------------------------------------
*/

      console.log("TICOMBO_FIRST_PUBLISH_DISABLED", {
  listing_id: listing.id,
  ticket_id: listing.ticket_id,
});

continue;
          console.log(
            `Publishing new Ticombo listing for ticket ${listing.ticket_id}`,
          );

          const publishResult = await publishTicomboTicket(listing.ticket_id);

          await pool.query(
            `
    UPDATE marketplace_listings
    SET
      sync_status = 'synced',
      remote_listing_id = $1,
      external_listing_id = $1,
      last_quantity_synced = $2,
      marketplace_price = $3,
      last_sync_at = NOW(),
      updated_at = NOW(),
      last_error = NULL,
      retry_count = 0,
      next_retry_at = NULL,
      circuit_breaker_until = NULL
    WHERE id = $4
    `,
            [
              publishResult.remoteListingId,
              currentQuantity,
              currentPrice,
              listing.id,
            ],
          );

          console.log(
            `Ticombo listing published successfully: ${publishResult.remoteListingId}`,
          );

          continue;
        }
        let action = "quantity_price_sync";
        let resultingSyncStatus = listing.sync_status || "synced";

        /*
|--------------------------------------------------------------------------
| AUTO REPUBLISH WHEN QUANTITY RETURNS ABOVE ZERO
|--------------------------------------------------------------------------
*/

        if (listing.sync_status === "deleted" && currentQuantity > 0) {
          if (listing.marketplace === "ticombo") {
            console.log("AUTO_REPUBLISH_TICOMBO_DISABLED", {
              listing_id: listing.id,
              ticket_id: listing.ticket_id,
              currentQuantity,
            });

            continue;
          }

          responsePayload = {
            marketplace: listing.marketplace,
            action: "auto_republish_quantity_restored",
            listing_id: listing.id,
            placeholder: true,
            message: "Auto republish non implementato per questo marketplace",
          };

          continue;
        }

        /*
        |--------------------------------------------------------------------------
        | AUTO DELIST WHEN QUANTITY IS ZERO
        |--------------------------------------------------------------------------
        */

        if (listing.sync_status === "synced" && currentQuantity <= 0) {
          action = "auto_delist_zero_quantity";
          resultingSyncStatus = "deleted";

          if (listing.marketplace === "ticombo") {
            responsePayload = await autoDelistTicomboListing(listing);
          } else if (listing.marketplace === "sportevents365") {
            responsePayload = await autoDelistSportEvents365Listing(listing);
          } else if (listing.marketplace === "gigsberg") {
            responsePayload = await autoDelistGigsbergListing(listing);
          } else {
            responsePayload = {
              marketplace: listing.marketplace,
              action,
              listing_id: listing.id,
              placeholder: true,
              message:
                "Auto delist non implementato per questo marketplace: listing marcato deleted solo localmente",
            };
          }

          await pool.query(
            `
            UPDATE marketplace_listings
            SET
              sync_status = $1,
              last_quantity_synced = $2,
              last_quantity_sync_at = NOW(),
              marketplace_price = $4,
              quantity_sync_attempts =
                COALESCE(quantity_sync_attempts, 0) + 1,
              last_sync_at = NOW(),
              updated_at = NOW(),
              last_error = NULL,
              retry_count = 0,
              next_retry_at = NULL,
              circuit_breaker_until = NULL
            WHERE id = $3
            `,
            [resultingSyncStatus, currentQuantity, listing.id, currentPrice],
          );

          await pool.query(
            `
            INSERT INTO marketplace_sync_logs (
              marketplace_listing_id,
              ticket_id,
              marketplace,
              action,
              status,
              response_payload
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            `,
            [
              listing.id,
              listing.ticket_id,
              listing.marketplace,
              action,
              "success",
              responsePayload ? JSON.stringify(responsePayload) : null,
            ],
          );

          continue;
        }

        /*
        |--------------------------------------------------------------------------
        | SKIP DELETED LISTINGS WITH ZERO QUANTITY
        |--------------------------------------------------------------------------
        */

        if (listing.sync_status === "deleted") {
          console.log("Skipping deleted marketplace listing in quantity sync", {
            listing_id: listing.id,
            ticket_id: listing.ticket_id,
            marketplace: listing.marketplace,
            remote_listing_id: listing.remote_listing_id,
            currentQuantity,
          });

          continue;
        }

        /*
        |--------------------------------------------------------------------------
        | SPORTSEVENTS365
        |--------------------------------------------------------------------------
        */

        if (listing.marketplace === "sportevents365") {
          const quantityResponse = await updateSportEvents365Quantity(
            listing,
            currentQuantity,
          );

          const priceResponse = await updateSportEvents365Price(
            listing,
            currentPrice,
          );

          responsePayload = {
            quantity: quantityResponse,
            price: priceResponse,
          };
        }

        /*
        |--------------------------------------------------------------------------
        | TICOMBO
        |--------------------------------------------------------------------------
        */

        if (listing.marketplace === "ticombo") {
          responsePayload = await updateTicomboQuantityAndPrice(
            listing,
            currentQuantity,
            currentPrice,
          );
        }

        /*
        |--------------------------------------------------------------------------
        | GIGSBERG
        |--------------------------------------------------------------------------
        */

        if (listing.marketplace === "gigsberg") {
          responsePayload = await updateGigsbergQuantityAndPrice(
            listing,
            currentQuantity,
            currentPrice,
          );
        }

        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            sync_status = $1,
            last_quantity_synced = $2,
            last_quantity_sync_at = NOW(),
            marketplace_price = $4,
            quantity_sync_attempts =
              COALESCE(quantity_sync_attempts, 0) + 1,
            last_sync_at = NOW(),
            updated_at = NOW(),
            last_error = NULL,
              retry_count = 0,
              next_retry_at = NULL,
              circuit_breaker_until = NULL
          WHERE id = $3
          `,
          [resultingSyncStatus, currentQuantity, listing.id, currentPrice],
        );

        if (action !== "quantity_price_sync") {
          await pool.query(
            `
            INSERT INTO marketplace_sync_logs (
              marketplace_listing_id,
              ticket_id,
              marketplace,
              action,
              status,
              response_payload
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            `,
            [
              listing.id,
              listing.ticket_id,
              listing.marketplace,
              action,
              "success",
              responsePayload ? JSON.stringify(responsePayload) : null,
            ],
          );
        }
      } catch (listingError) {
        const detailedError = normalizeMarketplaceError(listingError);

        console.error("Marketplace quantity/price sync error:", {
          marketplace: listing.marketplace,
          listing_id: listing.id,
          ticket_id: listing.ticket_id,
          remote_listing_id: listing.remote_listing_id,
          sync_status: listing.sync_status,
          error: detailedError,
        });

        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            quantity_sync_attempts =
              COALESCE(quantity_sync_attempts, 0) + 1,
            retry_count =
              COALESCE(retry_count, 0) + 1,
            next_retry_at = NOW() + INTERVAL '5 minutes',
            circuit_breaker_until =
              CASE
                 WHEN COALESCE(retry_count, 0) + 1 >= 5
                 THEN NOW() + INTERVAL '30 minutes'
                 ELSE circuit_breaker_until
              END,
            sync_status =
              CASE
                WHEN COALESCE(retry_count, 0) + 1 >= 10
                THEN 'failed'
                ELSE sync_status
              END,
            last_error = $1,
            last_sync_at = NOW(),
            updated_at = NOW()
          WHERE id = $2
          `,
          [detailedError, listing.id],
        );

        await pool.query(
          `
          INSERT INTO marketplace_sync_logs (
            marketplace_listing_id,
            ticket_id,
            marketplace,
            action,
            status,
            error_message
          )
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            listing.id,
            listing.ticket_id,
            listing.marketplace,
            "quantity_price_sync",
            "failed",
            detailedError,
          ],
        );
      }
    }

    console.log(
      `Marketplace quantity/price sync job completed. Listings processed: ${listings.length}`,
    );
  } catch (err) {
    console.error("Marketplace quantity/price sync fatal error:", {
      marketplace: listing?.marketplace,
      listing_id: listing?.id,
      ticket_id: listing?.ticket_id,
      remote_listing_id: listing?.remote_listing_id,
      error: normalizeMarketplaceError(err),
    });
  }
}

module.exports = {
  syncMarketplaceQuantities,
};
