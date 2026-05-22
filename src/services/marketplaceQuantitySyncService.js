const pool = require("../db");

const {
  updateSupplierTicket,
} = require("./integrations/sportevents365/sportevents365Api");

const {
  updateTicomboListing,
  deleteTicomboListing,
} = require("./integrations/ticombo/ticomboListings");

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
| TICOMBO QUANTITY + PRICE SYNC
|--------------------------------------------------------------------------
*/

async function updateTicomboQuantityAndPrice(listing, quantity, price) {
  if (!listing.remote_listing_id) {
    throw new Error("remote_listing_id mancante per Ticombo");
  }

  const payload = {
    quantity: Number(quantity),
  };

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
| GIGSBERG PLACEHOLDER
|--------------------------------------------------------------------------
*/

async function updateGigsbergQuantity(listing, quantity) {
  console.log(
    `Gigsberg quantity sync placeholder: listing ${listing.id}, qty ${quantity}`,
  );

  return {
    marketplace: "gigsberg",
    listing_id: listing.id,
    quantity,
    placeholder: true,
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
      WHERE ml.sync_status IN ('synced', 'deleted')
    `);

    const listings = listingsResult.rows;

    for (const listing of listings) {
      try {
        const currentQuantity = Number(listing.available_quantity || 0);
        const currentPrice = Number(listing.current_price || 0);

        let responsePayload = null;
        let action = "quantity_price_sync";
        let resultingSyncStatus = listing.sync_status || "synced";

        /*
        |--------------------------------------------------------------------------
        | AUTO REPUBLISH WHEN QUANTITY RETURNS ABOVE ZERO
        |--------------------------------------------------------------------------
        */

        if (listing.sync_status === "deleted" && currentQuantity > 0) {
          action = "auto_republish_quantity_restored";
          resultingSyncStatus = "synced";

          if (listing.marketplace === "ticombo") {
            responsePayload = await autoRepublishTicomboListing(
              listing,
              currentQuantity,
              currentPrice,
            );

            await pool.query(
              `
              UPDATE marketplace_listings
              SET
                sync_status = $1,
                remote_listing_id = $2,
                external_listing_id = $2,
                last_quantity_synced = $3,
                last_quantity_sync_at = NOW(),
                marketplace_price = $4,
                quantity_sync_attempts =
                  COALESCE(quantity_sync_attempts, 0) + 1,
                last_sync_at = NOW(),
                updated_at = NOW(),
                last_error = NULL
              WHERE id = $5
              `,
              [
                resultingSyncStatus,
                responsePayload.new_remote_listing_id,
                currentQuantity,
                currentPrice,
                listing.id,
              ],
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
                JSON.stringify(responsePayload),
              ],
            );

            continue;
          }

          responsePayload = {
            marketplace: listing.marketplace,
            action,
            listing_id: listing.id,
            placeholder: true,
            message:
              "Auto republish non ancora implementato per questo marketplace",
          };

          await pool.query(
            `
            UPDATE marketplace_listings
            SET
              last_quantity_synced = $1,
              last_quantity_sync_at = NOW(),
              marketplace_price = $3,
              quantity_sync_attempts =
                COALESCE(quantity_sync_attempts, 0) + 1,
              last_sync_at = NOW(),
              updated_at = NOW(),
              last_error = NULL
            WHERE id = $2
            `,
            [currentQuantity, listing.id, currentPrice],
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
              "skipped",
              JSON.stringify(responsePayload),
            ],
          );

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
            responsePayload = {
              marketplace: "sportevents365",
              action,
              listing_id: listing.id,
              placeholder: true,
              message:
                "Auto delist SportEvents365 non ancora implementato: listing marcato deleted solo localmente",
            };
          } else if (listing.marketplace === "gigsberg") {
            responsePayload = {
              marketplace: "gigsberg",
              action,
              listing_id: listing.id,
              placeholder: true,
              message:
                "Auto delist Gigsberg non ancora implementato: listing marcato deleted solo localmente",
            };
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
              last_error = NULL
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

        if (listing.sync_status === "deleted" && currentQuantity <= 0) {
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
          responsePayload = await updateGigsbergQuantity(
            listing,
            currentQuantity,
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
            last_error = NULL
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
      } catch (listingError) {
        const detailedError = normalizeMarketplaceError(listingError);

        console.error("Marketplace quantity/price sync error:", detailedError);

        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            quantity_sync_attempts =
              COALESCE(quantity_sync_attempts, 0) + 1,
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
    console.error(
      "Marketplace quantity/price sync fatal error:",
      normalizeMarketplaceError(err),
    );
  }
}

module.exports = {
  syncMarketplaceQuantities,
};
