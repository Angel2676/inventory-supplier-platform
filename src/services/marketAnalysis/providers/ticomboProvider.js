const pool = require("../../../db");

const {
  searchTicomboListings,
} = require("../../integrations/ticombo/ticomboListings");

function calculateStats(prices) {
  const validPrices = prices
    .map((price) => Number(price))
    .filter((price) => price > 0);

  if (!validPrices.length) {
    return {
      lowestPrice: null,
      highestPrice: null,
      averagePrice: null,
      listingsCount: 0,
    };
  }

  const lowestPrice = Math.min(...validPrices);
  const highestPrice = Math.max(...validPrices);
  const averagePrice =
    validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;

  return {
    lowestPrice: Number(lowestPrice.toFixed(2)),
    highestPrice: Number(highestPrice.toFixed(2)),
    averagePrice: Number(averagePrice.toFixed(2)),
    listingsCount: validPrices.length,
  };
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function extractPrices(listings, category) {
  const targetCategory = normalize(category);

  const activeListings = listings.filter(
    (listing) => normalize(listing.status) === "active",
  );

  const filteredActiveListings = activeListings.filter((listing) => {
    if (!targetCategory) return true;

    return normalize(listing.category) === targetCategory;
  });

  const fallbackListings = listings.filter((listing) => {
    if (!targetCategory) return true;

    return normalize(listing.category) === targetCategory;
  });

  const sourceListings = filteredActiveListings.length
    ? filteredActiveListings
    : fallbackListings;

  const prices = sourceListings
    .map((listing) => Number(listing.price))
    .filter((price) => Number.isFinite(price) && price > 0);

  return {
    prices,
    activeCount: filteredActiveListings.length,
    fallbackCount: fallbackListings.length,
    usedFallback:
      filteredActiveListings.length === 0 && fallbackListings.length > 0,
  };
}

async function analyzeTicomboMarket({ eventId, category, block }) {
  const result = await pool.query(
    `
    SELECT
      ml.id AS listing_id,
      ml.remote_listing_id,
      ml.remote_event_id,
      ml.remote_category_id,
      ml.marketplace_price,
      ml.last_market_price AS listing_last_market_price,
      ml.last_suggested_price,
      t.id AS ticket_id,
      t.category,
      t.block,
      t.last_market_price AS ticket_last_market_price,
      t.min_price,
      e.name AS event_name
    FROM marketplace_listings ml
    JOIN tickets t ON t.id = ml.ticket_id
    JOIN events e ON e.id = t.event_id
    WHERE ml.marketplace = 'ticombo'
      AND t.event_id = $1
      AND ($2::text IS NULL OR LOWER(t.category) = LOWER($2))
      AND ($3::text IS NULL OR LOWER(COALESCE(t.block, '')) = LOWER($3))
    ORDER BY ml.marketplace_price ASC NULLS LAST
    `,
    [eventId, category || null, block || null],
  );

  const rows = result.rows;

  const firstRowWithRemoteEvent = rows.find((row) => row.remote_event_id);

  let liveMarket = null;

  if (firstRowWithRemoteEvent?.remote_event_id) {
    try {
      const response = await searchTicomboListings({
        eventId: firstRowWithRemoteEvent.remote_event_id,
        page: 1,
        limit: 100,
      });

      const listings = Array.isArray(response?.data) ? response.data : [];
      const extracted = extractPrices(listings, category);
      const livePrices = extracted.prices;
      const liveStats = calculateStats(livePrices);

      liveMarket = {
        source: "ticombo_api_live",
        remoteEventId: firstRowWithRemoteEvent.remote_event_id,
        lowestPrice: liveStats.lowestPrice,
        highestPrice: liveStats.highestPrice,
        averagePrice: liveStats.averagePrice,
        listingsCount: liveStats.listingsCount,
        prices: livePrices,
        activeCount: extracted.activeCount,
        fallbackCount: extracted.fallbackCount,
        usedFallback: extracted.usedFallback,
        status: livePrices.length
          ? extracted.usedFallback
            ? "fallback_non_active_prices"
            : "ok"
          : "no_live_prices",
      };
    } catch (error) {
      liveMarket = {
        source: "ticombo_api_live",
        remoteEventId: firstRowWithRemoteEvent.remote_event_id,
        lowestPrice: null,
        highestPrice: null,
        averagePrice: null,
        listingsCount: 0,
        prices: [],
        status: "api_live_error",
        error: error.response?.data || error.message,
      };
    }
  }

  const marketPrices = rows.map(
    (row) =>
      row.listing_last_market_price ||
      row.ticket_last_market_price ||
      row.last_suggested_price ||
      row.marketplace_price,
  );

  const stats = calculateStats(marketPrices);

  const liveReference = liveMarket?.lowestPrice || null;

  const enrichedRows = rows.map((row) => {
    const marketReferencePrice =
      row.listing_last_market_price ||
      row.ticket_last_market_price ||
      row.last_suggested_price ||
      null;

    const yourPrice = Number(row.marketplace_price || 0);
    const dbMarketPrice = Number(marketReferencePrice || 0);

    const difference =
      yourPrice > 0 && dbMarketPrice > 0
        ? Number((yourPrice - dbMarketPrice).toFixed(2))
        : null;

    const liveDifference =
      yourPrice > 0 && liveReference > 0
        ? Number((yourPrice - liveReference).toFixed(2))
        : null;

    let position = "unknown";

    if (liveDifference !== null) {
      if (liveDifference > 0) position = "over_live_market";
      if (liveDifference < 0) position = "under_live_market";
      if (liveDifference === 0) position = "at_live_market";
    } else if (difference !== null) {
      if (difference > 0) position = "over_market";
      if (difference < 0) position = "under_market";
      if (difference === 0) position = "at_market";
    }

    return {
      ...row,
      your_price: yourPrice || null,
      market_reference_price: dbMarketPrice || null,
      market_difference: difference,
      live_market_reference_price: liveReference,
      live_market_difference: liveDifference,
      market_position: position,
    };
  });

  return {
    marketplace: "ticombo",
    eventId,
    eventName: rows[0]?.event_name || null,
    category: category || null,
    block: block || null,
    lowestPrice: stats.lowestPrice,
    highestPrice: stats.highestPrice,
    averagePrice: stats.averagePrice,
    listingsCount: stats.listingsCount,
    currency: "EUR",
    liveMarket,
    rawData: enrichedRows,
    status: rows.length > 0 ? "ok" : "no_data",
  };
}

module.exports = {
  analyzeTicomboMarket,
};
