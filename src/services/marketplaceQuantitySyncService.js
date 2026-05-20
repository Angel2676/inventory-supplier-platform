const pool = require("../db");

const {
  updateSupplierTicket
} = require("./integrations/sportevents365/sportevents365Api");

/*
|--------------------------------------------------------------------------
| SPORTSEVENTS365
|--------------------------------------------------------------------------
*/

async function updateSportEvents365Quantity(listing, quantity) {
  if (!listing.remote_event_id || !listing.remote_listing_id) {
    throw new Error(
      "remote_event_id o remote_listing_id mancanti per SportEvents365"
    );
  }

  const response = await updateSupplierTicket(
    listing.remote_event_id,
    listing.remote_listing_id,
    {
      quantity: Number(quantity)
    }
  );

  return {
    marketplace: "sportevents365",
    listing_id: listing.id,
    remote_event_id: listing.remote_event_id,
    remote_listing_id: listing.remote_listing_id,
    quantity: Number(quantity),
    response
  };
}

/*
|--------------------------------------------------------------------------
| GIGSBERG PLACEHOLDER
|--------------------------------------------------------------------------
*/

async function updateGigsbergQuantity(listing, quantity) {
  console.log(
    `Gigsberg quantity sync placeholder: listing ${listing.id}, qty ${quantity}`
  );

  return {
    marketplace: "gigsberg",
    listing_id: listing.id,
    quantity,
    placeholder: true
  };
}

/*
|--------------------------------------------------------------------------
| MAIN SYNC ENGINE
|--------------------------------------------------------------------------
*/

async function syncMarketplaceQuantities() {
  console.log("Marketplace quantity sync job started");

  try {
    const listingsResult = await pool.query(`
      SELECT
        ml.*,
        t.available_quantity
      FROM marketplace_listings ml
      JOIN tickets t
        ON t.id = ml.ticket_id
      WHERE ml.sync_status = 'synced'
    `);

    const listings = listingsResult.rows;

    for (const listing of listings) {
      try {
        const currentQuantity = Number(
          listing.available_quantity || 0
        );

        let responsePayload = null;

        /*
        |--------------------------------------------------------------------------
        | SPORTSEVENTS365
        |--------------------------------------------------------------------------
        */

        if (listing.marketplace === "sportevents365") {
          responsePayload =
            await updateSportEvents365Quantity(
              listing,
              currentQuantity
            );
        }

        /*
        |--------------------------------------------------------------------------
        | GIGSBERG
        |--------------------------------------------------------------------------
        */

        if (listing.marketplace === "gigsberg") {
          responsePayload =
            await updateGigsbergQuantity(
              listing,
              currentQuantity
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
            quantity_sync_attempts =
              COALESCE(quantity_sync_attempts, 0) + 1,
            last_sync_at = NOW(),
            last_error = NULL
          WHERE id = $2
          `,
          [
            currentQuantity,
            listing.id
          ]
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
            "quantity_sync",
            "success",
            responsePayload
              ? JSON.stringify(responsePayload)
              : null
          ]
        );

      } catch (listingError) {
        console.error(
          "Marketplace quantity sync error:",
          listingError.message
        );

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
          [
            listingError.message,
            listing.id
          ]
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
            "quantity_sync",
            "failed",
            listingError.message
          ]
        );
      }
    }

    console.log(
      `Marketplace quantity sync job completed. Listings processed: ${listings.length}`
    );

  } catch (err) {
    console.error(
      "Marketplace quantity sync fatal error:",
      err.message
    );
  }
}

module.exports = {
  syncMarketplaceQuantities
};