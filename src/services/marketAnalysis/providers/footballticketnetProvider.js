const pool = require("../../../db");
const {
  getVisibleFootballTicketNetPrices,
  normalizeFootballTicketNetCategory,
} = require("../../integrations/footballticketnet/footballticketnetPublicMarket");

function calculateStats(prices) {
  const validPrices = prices
    .map((price) => Number(price))
    .filter((price) => price > 10 && price < 10000);

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

async function getMappingPublicUrl({ eventId }) {
  const result = await pool.query(
    `
    SELECT public_url
    FROM marketplace_mappings
    WHERE marketplace = 'footballticketnet'
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
function normalizeFootballTicketNetTeamName(teamName) {
  const text = String(teamName || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const teamMap = {
    inter: "inter-milan",
    "inter milan": "inter-milan",
    milan: "ac-milan",
    "ac milan": "ac-milan",
    monza: "ac-monza",
    "ac monza": "ac-monza",
    juventus: "juventus",
    roma: "as-roma",
    "as roma": "as-roma",
    napoli: "ssc-napoli",
    "ssc napoli": "ssc-napoli",
    lazio: "lazio",
    torino: "torino",
    atalanta: "atalanta",
    fiorentina: "fiorentina",
    bologna: "bologna",
    genoa: "genoa",
    lecce: "lecce",
    parma: "parma",
    udinese: "udinese",
    verona: "hellas-verona",
    "hellas verona": "hellas-verona",
    cagliari: "cagliari",
    sassuolo: "sassuolo",
    como: "como",
    pisa: "pisa",
    cremonese: "cremonese",
  };

  return (
    teamMap[text] ||
    text.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  );
}

function buildFootballTicketNetPublicUrl(eventName) {
  const name = String(eventName || "").trim();

  if (!name) return null;

  const parts = name
    .split(/\s+vs\s+|\s+v\s+|\s+-\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const homeTeam = normalizeFootballTicketNetTeamName(parts[0]);
  const awayTeam = normalizeFootballTicketNetTeamName(parts[1]);

  if (!homeTeam || !awayTeam) return null;

  return `https://www.footballticketnet.com/italian-serie-a/${homeTeam}-vs-${awayTeam}`;
}

async function analyzeFootballTicketNetMarket({ eventId, category, block }) {
  const normalizedCategory = normalizeFootballTicketNetCategory(
    category,
    block,
  );

  const result = await pool.query(
    `
    SELECT
      ml.id AS listing_id,
      ml.remote_listing_id,
      ml.remote_event_id,
      ml.remote_category_id,
      ml.public_url,
      ml.marketplace_price,
      t.id AS ticket_id,
      t.category,
      t.block,
      e.name AS event_name
    FROM marketplace_listings ml
    JOIN tickets t ON t.id = ml.ticket_id
    JOIN events e ON e.id = t.event_id
    WHERE ml.marketplace = 'footballticketnet'
      AND t.event_id = $1
      AND ($2::text IS NULL OR LOWER(t.category) = LOWER($2))
      AND ($3::text IS NULL OR LOWER(COALESCE(t.block, '')) = LOWER($3))
    `,
    [eventId, category || null, block || null],
  );

  const mappingPublicUrl = await getMappingPublicUrl({ eventId });
  const listingPublicUrl =
    result.rows.find((row) => row.public_url)?.public_url || null;
  const eventName = result.rows[0]?.event_name || null;
  const generatedPublicUrl = buildFootballTicketNetPublicUrl(eventName);
  const publicUrl = mappingPublicUrl || listingPublicUrl || generatedPublicUrl;

  if (!publicUrl) {
    return {
      marketplace: "footballticketnet",
      eventId,
      category: category || null,
      block: block || null,
      normalizedCategory,
      publicUrl: null,
      lowestPrice: null,
      highestPrice: null,
      averagePrice: null,
      listingsCount: 0,
      currency: "EUR",
      rows: [],
      status: "missing_public_url",
    };
  }

  try {
    const rows = await getVisibleFootballTicketNetPrices(publicUrl, {
      category,
      block,
      headless: false,
    });

    const stats = calculateStats(rows.map((row) => row.price));

    return {
      marketplace: "footballticketnet",
      eventId,
      category: category || null,
      block: block || null,
      normalizedCategory,
      publicUrl,
      ...stats,
      currency: "EUR",
      rows,
      status: rows.length ? "ok" : "no_live_prices",
    };
  } catch (error) {
    console.error("FootballTicketNet live error:", {
      publicUrl,
      message: error.message,
      stack: error.stack,
    });
    return {
      marketplace: "footballticketnet",
      eventId,
      category: category || null,
      block: block || null,
      normalizedCategory,
      publicUrl,
      lowestPrice: null,
      highestPrice: null,
      averagePrice: null,
      listingsCount: 0,
      currency: "EUR",
      rows: [],
      status: "live_error",
      error: error.message,
    };
  }
}

module.exports = {
  analyzeFootballTicketNetMarket,
  normalizeFootballTicketNetCategory,
  buildFootballTicketNetPublicUrl,
};
