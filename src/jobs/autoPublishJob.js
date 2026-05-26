const cron = require("node-cron");
const pool = require("../db");

async function runAutoPublishJob() {
  console.log("Auto publish job started");

  try {
    const result = await pool.query(`
      INSERT INTO marketplace_listings (
        ticket_id,
        marketplace,
        remote_event_id,
        remote_category_id,
        sync_status,
        sync_direction,
        marketplace_price,
        min_price,
        auto_reprice_enabled,
        undercut_amount,
        created_at,
        updated_at
      )
      SELECT
        t.id AS ticket_id,
        'ticombo' AS marketplace,
        event_mapping.remote_event_id,
        category_mapping.remote_category_id,
        'needs_sync' AS sync_status,
        'inventory_to_marketplace' AS sync_direction,
        COALESCE(t.marketplace_price, t.partner_price, t.price) AS marketplace_price,
        t.min_price,
        t.auto_reprice_enabled,
        COALESCE(t.undercut_amount, 0.01) AS undercut_amount,
        NOW(),
        NOW()
      FROM tickets t
      JOIN marketplace_settings ms
        ON ms.marketplace = 'ticombo'
      JOIN marketplace_mappings event_mapping
        ON event_mapping.marketplace = 'ticombo'
       AND event_mapping.mapping_type = 'event'
       AND event_mapping.internal_event_id = t.event_id
       AND event_mapping.is_active = true
      JOIN marketplace_mappings category_mapping
        ON category_mapping.marketplace = 'ticombo'
       AND category_mapping.mapping_type = 'category'
       AND category_mapping.internal_event_id = t.event_id
       AND category_mapping.internal_category = t.category
       AND category_mapping.is_active = true
      WHERE t.status = 'available'
        AND t.available_quantity > 0
        AND ms.enabled = true
        AND ms.api_configured = true
        AND NOT EXISTS (
          SELECT 1
          FROM marketplace_listings ml
          WHERE ml.ticket_id = t.id
            AND ml.marketplace = 'ticombo'
            AND ml.sync_status NOT IN ('deleted', 'failed')
        )
      RETURNING id, ticket_id, marketplace
    `);

    if (result.rows.length > 0) {
      console.log("Auto publish queued listings:", result.rows);
    }

    console.log("Auto publish job completed");
  } catch (error) {
    console.error("Auto publish job error:", error);
  }
}

function startAutoPublishJob() {
  cron.schedule("*/5 * * * *", async () => {
    await runAutoPublishJob();
  });

  console.log("Auto publish job scheduled every 5 minutes");
}

module.exports = {
  runAutoPublishJob,
  startAutoPublishJob,
};
