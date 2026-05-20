const cron = require("node-cron");

const {
  syncListingsNeedingQuantityUpdate,
} = require("../services/marketplaceQuantitySyncService");

async function runMarketplaceSyncJob() {
  console.log("Marketplace quantity sync job started");

  const count = await syncListingsNeedingQuantityUpdate();

  console.log(
    `Marketplace quantity sync job completed. Listings processed: ${count}`,
  );
}

function startMarketplaceSyncJob() {
  cron.schedule("*/2 * * * *", async () => {
    await runMarketplaceSyncJob();
  });

  console.log("Marketplace quantity sync job scheduled every 2 minutes");
}

module.exports = {
  runMarketplaceSyncJob,
  startMarketplaceSyncJob,
};
