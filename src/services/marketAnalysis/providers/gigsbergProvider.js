const pool = require("../../../db");

const {
  getVisiblePublicPrices,
} = require("../../integrations/gigsberg/gigsbergPublicBrowserMarket");

const { searchListings } = require("../../integrations/gigsberg/gigsbergApi");

function calculateStats(prices) {
  const validPrices = prices
    .map((price) => Number(price))
    .filter((price) => price > 0);

  if (validPrices.length === 0) {
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

async function getMappingPublicUrl({ eventId }) {
  const result = await pool.query(
    `
    SELECT public_url
    FROM marketplace_mappings
    WHERE marketplace = 'gigsberg'
      AND mapping_type = 'event'
      AND internal_event_id = $1
      AND is_active = true
      AND public_url IS NOT NULL
      AND public_url <> ''
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [eventId],
  );

  return result.rows[0]?.public_url || null;
}
function extractGigsbergListingPrices(response) {
  const candidates = [];

  if (Array.isArray(response)) candidates.push(...response);
  if (Array.isArray(response?.data)) candidates.push(...response.data);
  if (Array.isArray(response?.items)) candidates.push(...response.items);
  if (Array.isArray(response?.content)) candidates.push(...response.content);
  if (Array.isArray(response?.content?.data)) {
    candidates.push(...response.content.data);
  }
  if (Array.isArray(response?.content?.items)) {
    candidates.push(...response.content.items);
  }

  return candidates
    .map((item) => {
      const value =
        item.price ||
        item.final_price ||
        item.selling_price ||
        item.marketplace_price ||
        item.amount ||
        item.price_value ||
        item?.price?.amount ||
        item?.price?.value;

      const price = Number(value);

      return Number.isFinite(price) && price > 0 ? price : null;
    })
    .filter((price) => price !== null);
}

async function buildApiLiveMarket({ rows }) {
  const firstRowWithRemoteIds = rows.find(
    (row) => row.remote_event_id && row.remote_category_id,
  );

  if (!firstRowWithRemoteIds) {
    return null;
  }

  try {
    const response = await searchListings({
      event_id: firstRowWithRemoteIds.remote_event_id,
      category_id: firstRowWithRemoteIds.remote_category_id,
      page: 1,
      per_page: 50,
    });

    const prices = extractGigsbergListingPrices(response);

    if (!prices.length) {
      return {
        source: "gigsberg_api_live",
        remoteEventId: firstRowWithRemoteIds.remote_event_id,
        remoteCategoryId: firstRowWithRemoteIds.remote_category_id,
        lowestPrice: null,
        highestPrice: null,
        averagePrice: null,
        listingsCount: 0,
        prices: [],
        status: "no_api_prices",
        rawResponse: response,
      };
    }

    const stats = calculateStats(prices);

    return {
      source: "gigsberg_api_live",
      remoteEventId: firstRowWithRemoteIds.remote_event_id,
      remoteCategoryId: firstRowWithRemoteIds.remote_category_id,
      lowestPrice: stats.lowestPrice,
      highestPrice: stats.highestPrice,
      averagePrice: stats.averagePrice,
      listingsCount: stats.listingsCount,
      prices,
      status: "ok",
    };
  } catch (error) {
    return {
      source: "gigsberg_api_live",
      remoteEventId: firstRowWithRemoteIds.remote_event_id,
      remoteCategoryId: firstRowWithRemoteIds.remote_category_id,
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

async function buildLiveMarket({ rows, category, eventId }) {
  const eventName = rows.find((row) => row.event_name)?.event_name || "";
  const normalizedEventName = String(eventName).toLowerCase();

  const sanSiro =
    normalizedEventName.includes("inter") ||
    normalizedEventName.includes("milan");

  const mappingPublicUrl = await getMappingPublicUrl({ eventId });
  const listingPublicUrl =
    rows.find((row) => row.public_url)?.public_url || null;

  const publicUrl = mappingPublicUrl || listingPublicUrl;

  if (!publicUrl) {
    return null;
  }

  try {
    const livePrices = await getVisiblePublicPrices(publicUrl, {
      categoryName: category || null,
      headless: true,
      sanSiro,
    });

    if (!livePrices.length) {
      return {
        source: "gigsberg_public_live",
        publicUrl,
        lowestPrice: null,
        highestPrice: null,
        averagePrice: null,
        listingsCount: 0,
        prices: [],
        status: "no_live_prices",
      };
    }

    const stats = calculateStats(livePrices);

    return {
      source: "gigsberg_public_live",
      publicUrl,
      lowestPrice: stats.lowestPrice,
      highestPrice: stats.highestPrice,
      averagePrice: stats.averagePrice,
      listingsCount: stats.listingsCount,
      prices: livePrices,
      status: "ok",
    };
  } catch (error) {
    return {
      source: "gigsberg_public_live",
      publicUrl,
      lowestPrice: null,
      highestPrice: null,
      averagePrice: null,
      listingsCount: 0,
      prices: [],
      status: "live_error",
      error: error.message,
    };
  }
}

async function analyzeGigsbergMarket({ eventId, category, block }) {
  const result = await pool.query(
    `
    SELECT
      
      ml.id AS listing_id,
      ml.remote_listing_id,
      ml.remote_event_id,
      ml.remote_category_id,
      ml.public_url,
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
    WHERE ml.marketplace = 'gigsberg'
      AND t.event_id = $1
      AND ($2::text IS NULL OR LOWER(t.category) = LOWER($2))
      AND ($3::text IS NULL OR LOWER(COALESCE(t.block, '')) = LOWER($3))
    ORDER BY ml.marketplace_price ASC NULLS LAST
    `,
    [eventId, category || null, block || null],
  );

  const rows = result.rows;

  const marketPrices = rows.map(
    (row) =>
      row.listing_last_market_price ||
      row.ticket_last_market_price ||
      row.last_suggested_price ||
      row.marketplace_price,
  );

  const stats = calculateStats(marketPrices);

  const enrichedRows = rows.map((row) => {
    const marketReferencePrice =
      row.listing_last_market_price ||
      row.ticket_last_market_price ||
      row.last_suggested_price ||
      null;

    const yourPrice = Number(row.marketplace_price || 0);
    const marketPrice = Number(marketReferencePrice || 0);

    const difference =
      yourPrice > 0 && marketPrice > 0
        ? Number((yourPrice - marketPrice).toFixed(2))
        : null;

    let position = "unknown";

    if (difference !== null) {
      if (difference > 0) position = "over_market";
      if (difference < 0) position = "under_market";
      if (difference === 0) position = "at_market";
    }

    return {
      ...row,
      your_price: yourPrice || null,
      market_reference_price: marketPrice || null,
      market_difference: difference,
      market_position: position,
    };
  });

  const apiLiveMarket = await buildApiLiveMarket({ rows });

  const publicLiveMarket = await buildLiveMarket({
    rows,
    category,
    eventId,
  });

  const liveMarket = apiLiveMarket || publicLiveMarket;

  return {
    marketplace: "gigsberg",
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
  analyzeGigsbergMarket,
};
