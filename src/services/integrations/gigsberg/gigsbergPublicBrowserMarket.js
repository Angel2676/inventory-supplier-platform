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

function normalizeMarketplaceCategory(value, options = {}) {
  const text = normalizeText(value);
  const { sanSiro = false } = options;

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

  // Regole speciali SOLO San Siro: Inter / Milan
  if (sanSiro) {
    if (text.includes("secondo anello arancio")) {
      return "long_middle_central"; // Category 1 Platinum
    }

    if (
      text.includes("primo anello arancio") ||
      text.includes("primo anello rosso")
    ) {
      return "long_lower"; // Category 1 Gold
    }

    if (
      text.includes("primo anello blu") ||
      text.includes("primo anello verde")
    ) {
      return "short_lower"; // Category 2
    }

    if (
      text.includes("secondo anello blu") ||
      text.includes("secondo anello verde")
    ) {
      return "short_middle"; // Category 3
    }

    if (text.includes("terzo anello rosso")) {
      return "long_upper"; // Category 1
    }

    if (
      text.includes("terzo anello blu") ||
      text.includes("terzo anello verde")
    ) {
      return "short_upper"; // Category 4
    }
  }

  if (text.includes("long lower") || text.includes("category 1 gold")) {
    return "long_lower";
  }

  if (
    text.includes("long side middle central red") ||
    text.includes("long side middle central orange") ||
    text.includes("category 1 platinum") ||
    text.includes("secondo arancio centrale") ||
    text.includes("secondo rosso centrale")
  ) {
    return "long_middle_central";
  }

  if (text.includes("long side middle") || text.includes("category 1 silver")) {
    return "long_middle";
  }

  if (text.includes("long upper") || text.includes("category 1")) {
    return "long_upper";
  }

  if (
    text.includes("short side upper green") ||
    text.includes("short side upper blue") ||
    text.includes("category 4")
  ) {
    return "short_upper";
  }

  if (
    text.includes("short side middle green") ||
    text.includes("short side middle blue") ||
    text.includes("category 3")
  ) {
    return "short_middle";
  }

  if (
    text.includes("short side lower green") ||
    text.includes("short side lower blue") ||
    text.includes("short side lower blu") ||
    text.includes("category 2")
  ) {
    return "short_lower";
  }

  return text;
}

function getCategoryAliases(categoryName, options = {}) {
  const normalized = normalizeMarketplaceCategory(categoryName, options);
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
  if (normalized === "long_upper") {
    aliases.add("long upper");
    aliases.add("terzo anello rosso");
    aliases.add("category 1");
  }

  if (normalized === "long_lower") {
    aliases.add("long lower");
    aliases.add("category 1 gold");
  }

  if (normalized === "long_middle_central") {
    aliases.add("long side middle central red");
    aliases.add("long side middle central orange");
    aliases.add("category 1 platinum");
    aliases.add("secondo arancio centrale");
    aliases.add("secondo rosso centrale");
  }

  if (normalized === "long_middle") {
    aliases.add("long side middle");
    aliases.add("category 1 silver");
  }

  if (normalized === "short_upper") {
    aliases.add("short side upper green");
    aliases.add("short side upper blue");
    aliases.add("terzo anello verde");
    aliases.add("terzo anello blu");
    aliases.add("category 4");
  }

  if (normalized === "short_middle") {
    aliases.add("short side middle green");
    aliases.add("short side middle blue");
    aliases.add("secondo anello verde");
    aliases.add("secondo anello blu");
    aliases.add("category 3");
  }

  if (normalized === "short_lower") {
    aliases.add("short side lower green");
    aliases.add("short side lower blue");
    aliases.add("short side lower blu");
    aliases.add("primo anello verde");
    aliases.add("primo anello blu");
    aliases.add("category 2");
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

function categoryMatches(line, categoryName, options = {}) {
  const normalizedLine = normalizeMarketplaceCategory(line, options);
  const aliases = getCategoryAliases(categoryName, options);

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

function extractCategoryPricesFromText(text, categoryName, options = {}) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedCategory = normalizeMarketplaceCategory(
    categoryName,
    options,
  );

  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedLine = normalizeMarketplaceCategory(line, options);

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
  const {
    headless = true,
    timeout = 45000,
    categoryName = null,
    sanSiro = false,
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
        { sanSiro },
      );

      console.log("CATEGORY FILTER:", categoryName);
      prices = categoryPrices.map((item) => item.eurPrice);
    }

    if (!prices.length && categoryName) {
      const normalizedCategory = normalizeMarketplaceCategory(categoryName, {
        sanSiro,
      });

      const isSafeGenericCategory = [
        "floor",
        "prato",
        "standing",
        "general",
        "general admission",
        "ga",
        "pitch",
        "parterre",
        "prato gold",
        "gold_circle",
        "los_vecinos",
      ].includes(normalizedCategory);

      if (!isSafeGenericCategory) {
        console.log(
          "CATEGORY FILTER EMPTY, NO FALLBACK TO ALL EVENT PRICES FOR SAFETY",
          {
            categoryName,
            normalizedCategory,
          },
        );

        return [];
      }

      console.log("CATEGORY FILTER EMPTY, SAFE GENERIC FALLBACK ENABLED", {
        categoryName,
        normalizedCategory,
      });
    }

    if (!prices.length) {
      const usdMatches =
        result.fullText.match(/US\$\s*[0-9]+(?:[.,][0-9]{2})?/g) || [];

      const numericMatches =
        result.fullText.match(/\b[0-9]{2,4}(?:[.,][0-9]{2})\b/g) || [];

      const parsedUsdPrices = usdMatches
        .map(parsePrice)
        .filter((price) => price !== null)
        .filter((price) => price > 10 && price < 10000)
        .map((price) => Number((price * USD_TO_EUR_RATE).toFixed(2)));

      const parsedNumericPrices = numericMatches
        .map(parsePrice)
        .filter((price) => price !== null)
        .filter((price) => price > 10 && price < 10000);

      prices = [...parsedUsdPrices, ...parsedNumericPrices];
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
async function findGigsbergPublicEventUrl({
  eventName,
  remoteEventId,
  headless = true,
}) {
  if (!remoteEventId) return null;

  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage();

    const searchUrl = `https://www.gigsberg.com/search?q=${encodeURIComponent(
      eventName || remoteEventId,
    )}`;

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(3000);

    const links = await page.$$eval("a[href]", (anchors) =>
      anchors.map((a) => a.href).filter(Boolean),
    );

    const match = links.find((href) => href.includes(`show-${remoteEventId}`));
    console.log("GIGSBERG PUBLIC EVENT URL LOOKUP:", {
      searchUrl,
      remoteEventId,
      eventName,
      linksFound: links.length,
      match,
    });

    return match || null;
  } catch (error) {
    return null;
  } finally {
    await browser.close();
  }
}

module.exports = {
  getVisiblePublicPrices,
  getVisibleLowestPublicPrice,
  findGigsbergPublicEventUrl,
};
