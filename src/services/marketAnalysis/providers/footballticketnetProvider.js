const pool = require("../../../db");
const { chromium } = require("playwright");

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/[^\d.,]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const price = Number(cleaned);

  return Number.isFinite(price) && price > 0 ? price : null;
}

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

function normalizeFootballTicketNetCategory(category, block) {
  const text = `${category || ""} ${block || ""}`
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.includes("away")) return "away";
  if (text.includes("vip") || text.includes("hospitality")) return "vip";

  if (text.includes("long") && text.includes("lower")) return "long_lower";
  if (text.includes("long") && text.includes("middle")) return "long_middle";
  if (text.includes("long") && text.includes("upper")) return "long_upper";

  if (text.includes("short") && text.includes("lower")) return "short_lower";
  if (text.includes("short") && text.includes("middle")) return "short_middle";
  if (text.includes("short") && text.includes("upper")) return "short_upper";

  if (text.includes("category 1")) return "category_1";
  if (text.includes("category 2")) return "category_2";
  if (text.includes("category 3")) return "category_3";
  if (text.includes("category 4")) return "category_4";

  return "generic";
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

function extractRowsFromText(fullText, { category, block }) {
  const normalizedTarget = normalizeFootballTicketNetCategory(category, block);

  const lines = fullText
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows = [];

  for (const line of lines) {
    const priceMatches =
      line.match(/(?:€|EUR|US\$|\$|£)\s*[0-9]{2,5}(?:[.,][0-9]{2})?/gi) ||
      line.match(/\b[0-9]{2,5}(?:[.,][0-9]{2})\b/g) ||
      [];

    for (const rawPrice of priceMatches) {
      const price = parsePrice(rawPrice);

      if (!price || price < 10 || price > 10000) continue;

      const normalizedCategory = normalizeFootballTicketNetCategory(line, "");

      const matchesCategory =
        normalizedTarget === "generic" ||
        normalizedCategory === normalizedTarget ||
        line.toLowerCase().includes(String(category || "").toLowerCase()) ||
        (block &&
          line.toLowerCase().includes(String(block || "").toLowerCase()));

      if (!matchesCategory) continue;

      rows.push({
        marketplace: "footballticketnet",
        category: category || null,
        block: block || null,
        normalizedCategory,
        price,
        currency: rawPrice.includes("$")
          ? "USD"
          : rawPrice.includes("£")
            ? "GBP"
            : "EUR",
        rawPrice,
        rawText: line,
      });
    }
  }

  return rows;
}

async function getVisibleFootballTicketNetPrices(publicUrl, options = {}) {
  const {
    headless = true,
    timeout = 45000,
    category = null,
    block = null,
  } = options;

  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    });

    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = request.url().toLowerCase();
      const type = request.resourceType();

      if (
        type === "image" ||
        type === "media" ||
        type === "font" ||
        url.includes("googletagmanager") ||
        url.includes("google-analytics") ||
        url.includes("facebook") ||
        url.includes("hotjar") ||
        url.includes("doubleclick") ||
        url.includes("newsletter") ||
        url.includes("popup")
      ) {
        return route.abort();
      }

      return route.continue();
    });

    await page.goto(publicUrl, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    await page.waitForTimeout(5000);

    const fullText = await page.evaluate(() => document.body?.innerText || "");

    return extractRowsFromText(fullText, { category, block });
  } finally {
    await browser.close();
  }
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
    WHERE ml.marketplace = 'footballticketnet'
      AND t.event_id = $1
      AND ($2::text IS NULL OR LOWER(t.category) = LOWER($2))
      AND ($3::text IS NULL OR LOWER(COALESCE(t.block, '')) = LOWER($3))
    ORDER BY ml.marketplace_price ASC NULLS LAST
    `,
    [eventId, category || null, block || null],
  );

  const dbRows = result.rows;

  const mappingPublicUrl = await getMappingPublicUrl({ eventId });
  const listingPublicUrl =
    dbRows.find((row) => row.public_url)?.public_url || null;
  const publicUrl = mappingPublicUrl || listingPublicUrl;

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
    const liveRows = await getVisibleFootballTicketNetPrices(publicUrl, {
      category,
      block,
      headless: true,
    });

    const prices = liveRows.map((row) => row.price);
    const stats = calculateStats(prices);

    return {
      marketplace: "footballticketnet",
      eventId,
      category: category || null,
      block: block || null,
      normalizedCategory,
      publicUrl,
      ...stats,
      currency: "EUR",
      rows: liveRows,
      status: liveRows.length ? "ok" : "no_live_prices",
    };
  } catch (error) {
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
  getVisibleFootballTicketNetPrices,
};
