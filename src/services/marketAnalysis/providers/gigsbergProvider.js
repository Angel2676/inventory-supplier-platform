const pool = require("../../../db");

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

async function analyzeGigsbergMarket({ eventId, category, block }) {
  const result = await pool.query(
    `
    SELECT
      ml.id AS listing_id,
      ml.remote_listing_id,
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
    rawData: enrichedRows,
    status: rows.length > 0 ? "ok" : "no_data",
  };
}

module.exports = {
  analyzeGigsbergMarket,
};
