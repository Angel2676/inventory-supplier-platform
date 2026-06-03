async function analyzeTicomboMarket({ eventId, category, block }) {
  return {
    marketplace: "ticombo",
    eventId,
    category,
    block,
    lowestPrice: null,
    highestPrice: null,
    averagePrice: null,
    listingsCount: 0,
    currency: "EUR",
    rawData: [],
    status: "pending_provider",
  };
}

module.exports = {
  analyzeTicomboMarket,
};
