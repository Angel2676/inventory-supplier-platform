const { analyzeGigsbergMarket } = require("./providers/gigsbergProvider");
const { analyzeTicomboMarket } = require("./providers/ticomboProvider");
const {
  analyzeFootballTicketNetMarket,
} = require("./providers/footballticketnetProvider");

const SUPPORTED_MARKETPLACES = [
  "gigsberg",
  "ticombo",
  "footballticketnet",
  "seatpin",
  "viagogo",
  "sportevents365",
];

async function runMarketAnalysis({
  eventId,
  category,
  block,
  marketplaces = [],
}) {
  const selectedMarketplaces =
    marketplaces.length > 0 ? marketplaces : SUPPORTED_MARKETPLACES;

  const results = [];

  for (const marketplace of selectedMarketplaces) {
    if (!SUPPORTED_MARKETPLACES.includes(marketplace)) {
      results.push({
        marketplace,
        eventId,
        category: category || null,
        block: block || null,
        lowestPrice: null,
        highestPrice: null,
        averagePrice: null,
        listingsCount: 0,
        currency: "EUR",
        rows: [],
        status: "unsupported_marketplace",
      });

      continue;
    }

    if (marketplace === "gigsberg") {
      results.push(
        await analyzeGigsbergMarket({
          eventId,
          category,
          block,
        }),
      );
    }

    if (marketplace === "ticombo") {
      results.push(
        await analyzeTicomboMarket({
          eventId,
          category,
          block,
        }),
      );
    }
    if (marketplace === "footballticketnet") {
      results.push(
        await analyzeFootballTicketNetMarket({
          eventId,
          category,
          block,
        }),
      );
    }

    if (["seatpin", "viagogo", "sportevents365"].includes(marketplace)) {
      results.push({
        marketplace,
        eventId,
        category: category || null,
        block: block || null,
        lowestPrice: null,
        highestPrice: null,
        averagePrice: null,
        listingsCount: 0,
        currency: "EUR",
        rows: [],
        status: "not_implemented_yet",
      });
    }
  }

  return {
    eventId,
    category: category || null,
    block: block || null,
    marketplaces: selectedMarketplaces,
    results,
  };
}

module.exports = {
  runMarketAnalysis,
};
