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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFootballTicketNetCategory(category, block) {
  const text = normalizeText(`${category || ""} ${block || ""}`);

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

function extractFootballTicketNetRowsFromText(fullText, { category, block }) {
  const normalizedTarget = normalizeFootballTicketNetCategory(category, block);

  const lines = String(fullText || "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const rows = [];

  for (const line of lines) {
    const lowerLine = normalizeText(line);

    const priceMatches =
      line.match(/(?:€|EUR|US\$|\$|£)\s*[0-9]{2,5}(?:[.,][0-9]{2})?/gi) ||
      line.match(/\b[0-9]{2,5}(?:[.,][0-9]{2})\b/g) ||
      [];

    for (const rawPrice of priceMatches) {
      const price = parsePrice(rawPrice);

      if (!price || price < 10 || price > 10000) continue;

      const normalizedCategory = normalizeFootballTicketNetCategory(line, "");

      const categoryText = normalizeText(category);
      const blockText = normalizeText(block);

      const matchesCategory =
        normalizedTarget === "generic" ||
        normalizedCategory === normalizedTarget ||
        (categoryText && lowerLine.includes(categoryText)) ||
        (blockText && lowerLine.includes(blockText));

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

    const rows = extractFootballTicketNetRowsFromText(fullText, {
      category,
      block,
    });

    console.log("FootballTicketNet public market:", {
      publicUrl,
      category,
      block,
      rowsFound: rows.length,
      lowestPrice: rows.length ? Math.min(...rows.map((row) => row.price)) : null,
    });

    return rows;
  } finally {
    await browser.close();
  }
}

module.exports = {
  getVisibleFootballTicketNetPrices,
  normalizeFootballTicketNetCategory,
  extractFootballTicketNetRowsFromText,
};
