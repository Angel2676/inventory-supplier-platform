require("dotenv").config();

const cron = require("node-cron");
const pool = require("../db");
const { getTicomboClient } = require("../services/integrations/ticombo/ticomboApi");
const {
  decreaseInventoryAndMarkMarketplaces,
} = require("../services/inventorySyncService");

const SYNC_FROM = new Date(
  process.env.TICOMBO_ORDERS_SYNC_FROM || "2026-06-01T00:00:00.000Z",
);

function isProcessableOrder(order) {
  return (
    String(order.status || "").toLowerCase() === "completed" &&
    order.orderId &&
    order.quantity &&
    new Date(order.date) >= SYNC_FROM
  );
}

async function syncTicomboOrders({ page = 1, limit = 100 } = {}) {
  const client = getTicomboClient();

  const res = await client.get("/orders", {
    params: { page, limit, include: "$total" },
  });

  const orders = res.data?.data || [];
  const stats = {
    fetched: orders.length,
    processed: 0,
    skipped_old_or_status: 0,
    skipped_duplicate: 0,
    skipped_missing_listing: 0,
    errors: 0,
  };

  for (const order of orders) {
    if (!isProcessableOrder(order)) {
      stats.skipped_old_or_status++;
      continue;
    }

    try {
      const existing = await pool.query(
        `
        SELECT id
        FROM marketplace_orders
        WHERE marketplace = 'ticombo'
          AND marketplace_order_id = $1
        LIMIT 1
        `,
        [order.orderId],
      );

      if (existing.rows.length) {
        stats.skipped_duplicate++;
        continue;
      }

      const listing = await pool.query(
        `
        SELECT *
        FROM marketplace_listings
        WHERE marketplace = 'ticombo'
          AND (
            remote_listing_id = $1
            OR external_listing_id = $1
            OR remote_listing_id = $2
            OR external_listing_id = $2
          )
        LIMIT 1
        `,
        [order.listingId || null, order.listingShortId || null],
      );

      if (!listing.rows.length) {
        stats.skipped_missing_listing++;

        await pool.query(
          `
          INSERT INTO marketplace_sync_logs (
            marketplace,
            action,
            status,
            response_payload,
            error_message
          )
          VALUES ($1,$2,$3,$4,$5)
          `,
          [
            "ticombo",
            "ticombo_order_skipped_missing_listing",
            "skipped",
            order,
            `Listing Ticombo non trovato: ${order.listingId || order.listingShortId}`,
          ],
        );

        continue;
      }

      const ml = listing.rows[0];

      const result = await decreaseInventoryAndMarkMarketplaces({
        ticketId: ml.ticket_id,
        quantity: Number(order.quantity),
        source: "ticombo_orders_sync",
        marketplace: "ticombo",
        referenceId: order.orderId,
      });

      await pool.query(
        `
        INSERT INTO marketplace_orders (
          marketplace,
          marketplace_order_id,
          marketplace_listing_id,
          ticket_id,
          event_name,
          quantity,
          total_amount,
          currency,
          order_status,
          fulfillment_status,
          raw_payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
        [
          "ticombo",
          order.orderId,
          ml.id,
          ml.ticket_id,
          order.event?.name || null,
          Number(order.quantity),
          order.totalPrice || null,
          order.currency || "EUR",
          order.status || "Completed",
          order.delivery?.status || "pending",
          order,
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
          response_payload,
          error_message
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          ml.id,
          ml.ticket_id,
          "ticombo",
          "ticombo_order_processed",
          "processed",
          {
            orderId: order.orderId,
            quantity: order.quantity,
            ticket: result.ticket,
          },
          null,
        ],
      );

      stats.processed++;
    } catch (err) {
      stats.errors++;
      console.error("Errore ordine Ticombo:", order.orderId, err.message);
    }
  }

  return stats;
}

function startTicomboOrdersSyncJob() {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const stats = await syncTicomboOrders();
      if (stats.processed || stats.errors || stats.skipped_missing_listing) {
        console.log("Ticombo orders sync scheduled:", stats);
      }
    } catch (error) {
      console.error("Ticombo orders sync scheduled error:", error);
    }
  });

  console.log("Ticombo orders sync job scheduled every 15 minutes");
}

module.exports = {
  syncTicomboOrders,
  startTicomboOrdersSyncJob,
};

if (require.main === module) {
  syncTicomboOrders()
    .then((stats) => {
      console.log("Ticombo orders sync completato:");
      console.table(stats);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Errore sync Ticombo orders:", err);
      process.exit(1);
    });
}
