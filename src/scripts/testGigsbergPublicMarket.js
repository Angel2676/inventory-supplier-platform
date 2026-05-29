const {
  getPublicLowestPriceForCategory,
} = require("../services/integrations/gigsberg/gigsbergPublicMarket");

async function main() {
  const result = await getPublicLowestPriceForCategory(
    "https://www.gigsberg.com/concert-tickets/pop/backstreet-boys-tickets/show-209998",
    388,
  );

  console.log(result);
}

main().catch(console.error);
