require("dotenv").config();

const { runRepricingJob } = require("../src/jobs/repricingJob");

const {
  runGigsbergMarketScannerJob,
} = require("../src/jobs/gigsbergMarketScannerJob");

const {
  runTicomboMarketScannerJob,
} = require("../src/jobs/ticomboMarketScannerJob");

async function main() {
  const job = process.argv[2];

  if (job === "gigsberg") {
    await runGigsbergMarketScannerJob();
    await runRepricingJob({ marketplaces: ["gigsberg"] });
  } else if (job === "ticombo") {
    await runTicomboMarketScannerJob();
    await runRepricingJob({ marketplaces: ["ticombo"] });
  } else if (job === "repricing") {
    await runRepricingJob();
  } else if (job === "all") {
    await runGigsbergMarketScannerJob();
    await runTicomboMarketScannerJob();
    await runRepricingJob();
  } else {
    console.log("Uso:");
    console.log("node scripts/run_marketplace_jobs.js gigsberg");
    console.log("node scripts/run_marketplace_jobs.js ticombo");
    console.log("node scripts/run_marketplace_jobs.js repricing");
    console.log("node scripts/run_marketplace_jobs.js all");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
