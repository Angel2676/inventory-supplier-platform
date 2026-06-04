const axios = require("axios");

function extractTicomboPublicListings(data) {
  const items = Array.isArray(data?.payload)
    ? data.payload
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];

  return items
    .map((item) => {
      const sellingEur =
        item.price?.sellingEur ??
        item.price?.selling?.value ??
        item.price?.originalEur ??
        item.price?.original?.value ??
        null;

      return {
        listingId: item.listingId,
        status: item.status,
        category: item.ticket?.category || "",
        section: item.ticket?.section || "",
        amount: item.ticket?.amount || null,
        sellerName:
          item.rel?.user?.displayName ||
          item.rel?.vUser?.representative?.name ||
          item.rel?.vUser?.firstName ||
          null,
        isOwnListing:
          item.rel?.user?.displayName === "Sportmaniatravel" ||
          item.rel?.user?.firstName === "Angelo",
        price: sellingEur ? Number(sellingEur) : null,
        currency: "EUR",
        originalPrice: item.price?.original?.value ?? null,
        sellingPrice: item.price?.selling?.value ?? null,
      };
    })
    .filter((item) => item.price && item.status === "ACTIVE");
}

async function getTicomboPublicEventListings(eventId, { quantity = 2 } = {}) {
  if (!eventId) {
    throw new Error("eventId obbligatorio per Ticombo public market API");
  }

  const response = await axios.get(
    `https://www.ticombo.com/prod/discovery/events/${eventId}/listings`,
    {
      params: {
        limit: 100,
        include: "$total",
        populate: "rel.user:seller|reservations:amount,expiresAt,price",
        sort: "lowestprice",
        quantity,
        hideUnavailableListings: false,
        allInPricing: true,
        platform: "tc_de",
      },
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
      timeout: 30000,
    },
  );

  const listings = extractTicomboPublicListings(response.data);

  const prices = listings
    .map((item) => item.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  const competitorListings = listings.filter((item) => !item.isOwnListing);

  const competitorPrices = competitorListings
    .map((item) => item.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  return {
    source: "ticombo_public_api",
    eventId,
    currency: "EUR",

    listingsCount: listings.length,

    lowestPrice: prices[0] || null,

    highestPrice: prices.length ? prices[prices.length - 1] : null,

    averagePrice: prices.length
      ? Number(
          (
            prices.reduce((sum, price) => sum + price, 0) / prices.length
          ).toFixed(2),
        )
      : null,

    competitorListingsCount: competitorListings.length,

    lowestCompetitorPrice: competitorPrices[0] || null,

    competitorPrices,

    prices,

    listings,
  };
}

module.exports = {
  getTicomboPublicEventListings,
  extractTicomboPublicListings,
};
