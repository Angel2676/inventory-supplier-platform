const axios = require("axios");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

async function getTicomboLowestMarketPrice({
  remoteEventId,
  category,
  block = null,
  quantity = 1,
  excludeListingId = null,
}) {
  if (!remoteEventId) {
    throw new Error("remoteEventId mancante");
  }

  const url = `https://www.ticombo.net/prod/discovery/events/${remoteEventId}/listings`;

  const response = await axios.get(url, {
    params: {
      limit: 100,
      include: "$total",
      populate: "rel.user:seller|reservations:amount,expiresAt,price",
      sort: "lowestprice",
      quantity,
      hideUnavailableListings: false,
      allInPricing: true,
      platform: "tc_it",
    },
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
    },
    timeout: 30000,
  });

  const listings = response.data?.payload || [];

  const targetCategory = normalize(category);
  const targetBlock = normalize(block);

  const filtered = listings.filter((listing) => {
    if (excludeListingId && listing.listingId === excludeListingId) {
      return false;
    }

    if (listing.status !== "ACTIVE") {
      return false;
    }

    if (listing.privacy?.type && listing.privacy.type !== "PUBLIC") {
      return false;
    }

    const listingCategory = normalize(listing.ticket?.category);
    const listingSection = normalize(listing.ticket?.section);

    if (targetCategory && listingCategory !== targetCategory) {
      return false;
    }

    if (targetBlock && !listingSection.includes(targetBlock)) {
      return false;
    }

    const sellingPrice = Number(listing.price?.sellingEur || 0);

    if (!sellingPrice || sellingPrice <= 0) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    return {
      lowestPrice: null,
      competitorListingId: null,
      rawCount: listings.length,
      matchedCount: 0,
    };
  }

  filtered.sort(
    (a, b) =>
      Number(a.price?.sellingEur || 999999) -
      Number(b.price?.sellingEur || 999999),
  );

  const best = filtered[0];

  return {
    lowestPrice: Number(best.price?.sellingEur || 0),
    competitorListingId: best.listingId,
    category: best.ticket?.category || null,
    section: best.ticket?.section || null,
    quantity: best.ticket?.amount || null,
    rawCount: listings.length,
    matchedCount: filtered.length,
  };
}

module.exports = {
  getTicomboLowestMarketPrice,
};
