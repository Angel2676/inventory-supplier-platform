const { chromium } = require("playwright");

const USD_TO_EUR_RATE = 0.85722;

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/\s/g, "")
    .replace(/US\$|€|EUR|£|\$/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const price = Number(cleaned);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-_/|]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMarketplaceCategory(value) {
  const text = normalizeText(value);

  if (
    text.includes("prato") ||
    text.includes("floor") ||
    text.includes("pitch") ||
    text.includes("standing") ||
    text.includes("general admission") ||
    text === "ga" ||
    text.includes("parterre") ||
    text.includes("innenraum")
  ) {
    return "floor";
  }

  if (
    text.includes("gold circle") ||
    text.includes("golden circle") ||
    text.includes("goldcircle")
  ) {
    return "gold_circle";
  }

  if (text.includes("los vecinos")) {
    return "los_vecinos";
  }

  return text;
}

function getCategoryAliases(categoryName) {
  const normalized = normalizeMarketplaceCategory(categoryName);
  const raw = normalizeText(categoryName);

  const aliases = new Set([normalized, raw]);

  if (normalized === "floor") {
    aliases.add("floor");
    aliases.add("prato");
    aliases.add("standing");
    aliases.add("general admission");
    aliases.add("ga");
    aliases.add("pitch");
    aliases.add("parterre");
    aliases.add("innenraum");
  }

  if (normalized === "gold_circle") {
    aliases.add("gold circle");
    aliases.add("golden circle");
    aliases.add("goldcircle");
    aliases.add("cercle d'or");
    aliases.add("cerchio oro");
  }

  if (normalized === "los_vecinos") {
    aliases.add("los vecinos");
  }

  if (
    raw.includes("seated") ||
    raw.includes("seat") ||
    raw.includes("tribuna") ||
    raw.includes("tribune")
  ) {
    aliases.add("seated");
    aliases.add("seat");
    aliases.add("tribuna");
    aliases.add("tribune");
  }

  if (
    raw.includes("vip") ||
    raw.includes("hospitality") ||
    raw.includes("premium")
  ) {
    aliases.add("vip");
    aliases.add("hospitality");
    aliases.add("premium");
  }

  return Array.from(aliases).filter(Boolean);
}

function categoryMatches(line, categoryName) {
  const normalizedLine = normalizeMarketplaceCategory(line);
  const aliases = getCategoryAliases(categoryName);

  if (!normalizedLine || aliases.length === 0) return false;

  return aliases.some((alias) => {
    if (!alias) return false;

    return (
      normalizedLine === alias ||
      normalizedLine.includes(alias) ||
      alias.includes(normalizedLine)
    );
  });
}

function extractCategoryPricesFromText(text, categoryName) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!categoryMatches(line, categoryName)) {
      continue;
    }

    const blockText = lines.slice(i, i + 25).join("\n");

    const priceMatch = blockText.match(/US\$\s*[0-9]+(?:[.,][0-9]{2})?/);

    if (priceMatch) {
      const usdPrice = parsePrice(priceMatch[0]);

      if (usdPrice) {
        const eurPrice = Number((usdPrice * USD_TO_EUR_RATE).toFixed(2));

        results.push({
          category: line,
          requestedCategory: categoryName,
          usdPrice,
          eurPrice,
          rawPrice: priceMatch[0],
        });
      }
    }
  }

  console.log("CATEGORY MATCH RESULTS:", {
    requestedCategory: categoryName,
    matchesFound: results.length,
    matches: results.slice(0, 5),
  });

  return results;
}
function extractCategoryPricesFromText(text, categoryName) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedCategory = normalizeMarketplaceCategory(categoryName);

  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedLine = normalizeText(line);

    if (!normalizedCategory || normalizedLine !== normalizedCategory) {
      continue;
    }

    const blockText = lines.slice(i, i + 20).join("\n");

    const priceMatch = blockText.match(/US\$\s*[0-9]+(?:[.,][0-9]{2})?/);

    if (priceMatch) {
      const usdPrice = parsePrice(priceMatch[0]);

      if (usdPrice) {
        const eurPrice = Number((usdPrice * USD_TO_EUR_RATE).toFixed(2));

        results.push({
          category: line,
          usdPrice,
          eurPrice,
          rawPrice: priceMatch[0],
        });
      }
    }
  }

  return results;
}

async function getVisiblePublicPrices(publicUrl, options = {}) {
  const { headless = true, timeout = 45000, categoryName = null } = options;

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
        type === "iframe" ||
        url.includes("shopperapproved") ||
        url.includes("googletagmanager") ||
        url.includes("google-analytics") ||
        url.includes("facebook") ||
        url.includes("hotjar") ||
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

    await page.waitForTimeout(3000);

    try {
      const anyButton = page.getByText("Any", { exact: true });

      if (await anyButton.isVisible({ timeout: 5000 })) {
        await anyButton.click({ force: true });
        console.log("Popup quantità chiuso");
        await page.waitForTimeout(5000);
      }
    } catch (error) {
      console.log("Popup quantità non presente o non chiuso:", error.message);
    }

    await page.waitForTimeout(5000);

    const result = await page.evaluate((categoryNameFromNode) => {
      const text = document.body?.innerText || "";

      return {
        textPreview: text.slice(0, 2500),
        fullText: text,
        categoryName: categoryNameFromNode,
      };
    }, categoryName);

    let prices = [];

    if (categoryName) {
      const categoryPrices = extractCategoryPricesFromText(
        result.fullText,
        categoryName,
      );

      console.log("CATEGORY FILTER:", categoryName);
      prices = categoryPrices.map((item) => item.eurPrice);
    }

    if (!prices.length && categoryName) {
      console.log(
        "CATEGORY FILTER EMPTY, NO FALLBACK TO ALL EVENT PRICES FOR SAFETY",
        {
          categoryName,
        },
      );

      return [];
    }

    if (!prices.length) {
      const rawMatches =
        result.fullText.match(/US\$\s*[0-9]+(?:[.,][0-9]{2})?/g) || [];

      const parsedPricesUsd = rawMatches
        .map(parsePrice)
        .filter((price) => price !== null)
        .filter((price) => price > 10 && price < 10000);

      prices = parsedPricesUsd.map((price) =>
        Number((price * USD_TO_EUR_RATE).toFixed(2)),
      );

      console.log("NO CATEGORY PROVIDED, FALLBACK TO ALL EVENT PRICES");
    }

    const finalPrices = [...new Set(prices)]

      .filter((price) => price > 10 && price < 10000)

      .sort((a, b) => a - b);

    console.log("Gigsberg browser market prices:", {
      categoryName,

      pricesFound: finalPrices.length,

      lowestPrice: finalPrices.length ? finalPrices[0] : null,
    });

    return finalPrices;
  } finally {
    await browser.close();
  }
}

async function getVisibleLowestPublicPrice(publicUrl, options = {}) {
  const { ownPrice = null, ownPriceTolerance = 2 } = options;

  const prices = await getVisiblePublicPrices(publicUrl, options);

  if (!prices.length) {
    return null;
  }

  const own = ownPrice !== null ? Number(ownPrice) : null;

  const competitorPrices = prices.filter((price) => {
    if (!own || !Number.isFinite(own)) return true;

    return Math.abs(Number(price) - own) > ownPriceTolerance;
  });

  console.log("GIGSBERG OWN PRICE EXCLUSION:", {
    ownPrice: own,
    ownPriceTolerance,
    allPrices: prices,
    competitorPrices,
  });

  const finalPrices = competitorPrices.length ? competitorPrices : prices;

  return {
    min_price: finalPrices[0],
    prices: finalPrices,
    all_prices: prices,
    excluded_own_price: own,
  };
}

module.exports = {
  getVisiblePublicPrices,
  getVisibleLowestPublicPrice,
};
