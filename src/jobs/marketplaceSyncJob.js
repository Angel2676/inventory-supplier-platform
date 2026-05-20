const cron = require("node-cron");

const {
  syncMarketplaceQuantities,
} = require("../services/marketplaceQuantitySyncService");

async function runMarketplaceSyncJob() {
  console.log("Marketplace quantity sync job started");

  await syncMarketplaceQuantities();

  console.log("Marketplace quantity sync job completed");
}

function startMarketplaceSyncJob() {
  cron.schedule("*/2 * * * *", async () => {
    try {
      await runMarketplaceSyncJob();
    } catch (error) {
      console.error("Marketplace quantity sync job error:", error);
    }
  });

  console.log("Marketplace quantity sync job scheduled every 2 minutes");
}

module.exports = {
  startMarketplaceSyncJob,
  runMarketplaceSyncJob,
};
