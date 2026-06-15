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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTicomboCategory(item, category, block) {
  const wantedCategory = normalizeText(category);
  const wantedBlock = normalizeText(block);

  const itemCategory = normalizeText(item.category);
  const itemSection = normalizeText(item.section);

  if (!wantedCategory) return true;

  const categoryMatches =
    itemCategory === wantedCategory ||
    itemSection === wantedCategory ||
    itemCategory.includes(wantedCategory) ||
    wantedCategory.includes(itemCategory) ||
    itemSection.includes(wantedCategory) ||
    wantedCategory.includes(itemSection);

  if (!categoryMatches) return false;

  if (!wantedBlock) return true;

  return (
    itemSection === wantedBlock ||
    itemSection.includes(wantedBlock) ||
    wantedBlock.includes(itemSection)
  );
}

async function getTicomboPublicEventListings(
  eventId,
  { quantity = 2, category = "", block = "", excludeListingId = "" } = {},
) {
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

  const matchedListings = listings.filter((item) =>
    matchesTicomboCategory(item, category, block),
  );

  const listingsForPrice = matchedListings.length ? matchedListings : listings;

  const prices = listingsForPrice
    .map((item) => item.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  const competitorListings = listingsForPrice.filter((item) => {
    const sameListing =
      excludeListingId &&
      String(item.listingId || "") === String(excludeListingId || "");

    return !item.isOwnListing && !sameListing;
  });

  const competitorPrices = competitorListings
    .map((item) => item.price)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  return {
    source: "ticombo_public_api",
    eventId,
    currency: "EUR",
    category,
    block,

    listingsCount: listings.length,
    matchedListingsCount: matchedListings.length,

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

    listings: listingsForPrice,
  };
}

module.exports = {
  getTicomboPublicEventListings,
  extractTicomboPublicListings,
};
