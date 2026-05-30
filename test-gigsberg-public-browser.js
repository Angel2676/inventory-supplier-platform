const {
  getVisibleLowestPublicPrice,
} = require("./src/services/integrations/gigsberg/gigsbergPublicBrowserMarket");

async function main() {
  const url =
    "https://www.gigsberg.com/concert-tickets/pop/backstreet-boys-tickets/show-209998";

  const result = await getVisibleLowestPublicPrice(url, {
    headless: false,
    ownPrice: 301.76,
    ownPriceTolerance: 2,
  });

  console.log("VISIBLE PUBLIC MARKET RESULT:", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
