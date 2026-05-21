const pool = require("../db");

const {
  updateSupplierTicket,
} = require("./integrations/sportevents365/sportevents365Api");

const {
  updateTicomboListing,
} = require("./integrations/ticombo/ticomboListings");

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
    listing_id: listing.id,
    remote_listing_id: listing.remote_listing_id,
    quantity: Number(quantity),
    price: price !== undefined && price !== null ? Number(price) : null,
    response,
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
      WHERE ml.sync_status = 'synced'
    `);

    const listings = listingsResult.rows;

    for (const listing of listings) {
      try {
        const currentQuantity = Number(listing.available_quantity || 0);
        const currentPrice = Number(listing.current_price || 0);

        let responsePayload = null;

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

        /*
        |--------------------------------------------------------------------------
        | UPDATE MARKETPLACE LISTING
        |--------------------------------------------------------------------------
        */

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
            last_error = NULL
          WHERE id = $2
          `,
          [currentQuantity, listing.id, currentPrice],
        );

        /*
        |--------------------------------------------------------------------------
        | LOG SUCCESS
        |--------------------------------------------------------------------------
        */

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
            "quantity_price_sync",
            "success",
            responsePayload ? JSON.stringify(responsePayload) : null,
          ],
        );
      } catch (listingError) {
        const detailedError = normalizeMarketplaceError(listingError);

        console.error("Marketplace quantity/price sync error:", detailedError);

        /*
        |--------------------------------------------------------------------------
        | UPDATE ERROR
        |--------------------------------------------------------------------------
        */

        await pool.query(
          `
          UPDATE marketplace_listings
          SET
            quantity_sync_attempts =
              COALESCE(quantity_sync_attempts, 0) + 1,
            last_error = $1,
            last_sync_at = NOW()
          WHERE id = $2
          `,
          [detailedError, listing.id],
        );

        /*
        |--------------------------------------------------------------------------
        | LOG ERROR
        |--------------------------------------------------------------------------
        */

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
