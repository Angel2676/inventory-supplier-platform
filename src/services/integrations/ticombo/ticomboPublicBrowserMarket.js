const { chromium } = require("playwright");

function parseTicomboPrice(text) {
  if (!text) return null;

  const raw = String(text).trim();

  const match = raw.match(
    /(?:CHF|EUR|€)\s*([\d.,]+)|([\d.,]+)\s*(?:CHF|EUR|€)/i,
  );

  if (!match) return null;

  const valueText = match[1] || match[2];

  if (!valueText) return null;

  let normalized = valueText;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    const parts = normalized.split(",");
    const lastPart = parts[parts.length - 1];

    if (lastPart.length === 3) {
      normalized = normalized.replace(/,/g, "");
    } else {
      normalized = normalized.replace(",", ".");
    }
  } else if (!hasComma && hasDot) {
    const parts = normalized.split(".");
    const lastPart = parts[parts.length - 1];

    if (lastPart.length === 3) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const value = Number(normalized);

  return Number.isFinite(value) && value > 0 ? value : null;
}
function normalizeTicomboEventUrl(url) {
  if (!url) return null;

  const cleanUrl = String(url).trim();

  // Se arriva shortUrl del singolo listing:
  // /discover/{eventId}/{listingId}/buy
  const discoverMatch = cleanUrl.match(
    /https:\/\/www\.ticombo\.com\/[^/]+\/discover\/([^/]+)\/([^/]+)\/buy/i,
  );

  if (discoverMatch) {
    const eventId = discoverMatch[1];

    // Non possiamo ricostruire slug evento da qui.
    // Quindi meglio bloccare e usare pagina evento pubblica.
    throw new Error(
      `ShortUrl listing non valido per market scan. Usa la pagina evento pubblica Ticombo per eventId ${eventId}`,
    );
  }

  const urlObj = new URL(cleanUrl);

  urlObj.searchParams.set("quantity", "2");
  urlObj.searchParams.delete("backClicked");

  return urlObj.toString();
}
async function getTicomboPublicMarketPrices(
  eventUrl,
  { headless = true } = {},
) {
  if (!eventUrl) {
    throw new Error("eventUrl obbligatorio per Ticombo public market");
  }

  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 1000 },
      locale: "en-US",
    });

    const normalizedEventUrl = normalizeTicomboEventUrl(eventUrl);

    await page.goto(normalizedEventUrl, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(3000);
    console.log("Current URL:", page.url());

    const bodyText = await page.textContent("body");

    console.log(
      "Currency detected:",
      bodyText.includes("EUR")
        ? "EUR"
        : bodyText.includes("CHF")
          ? "CHF"
          : "UNKNOWN",
    );

    const prices = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll("body *"))
        .map((el) => el.innerText)
        .filter(Boolean);

      return texts
        .flatMap((text) => text.split("\n"))
        .map((line) => line.trim())
        .filter((line) =>
          /(?:€|EUR|CHF)\s?\d|\d[\d.,]*\s?(?:€|EUR|CHF)/i.test(line),
        );
    });

    const parsedPrices = prices
      .map((text) => ({
        text,
        currency: String(text).includes("CHF")
          ? "CHF"
          : String(text).includes("EUR") || String(text).includes("€")
            ? "EUR"
            : null,
        price: parseTicomboPrice(text),
      }))
      .filter((item) => item.price && item.currency);

    const uniquePrices = Array.from(
      new Map(parsedPrices.map((item) => [item.price, item])).values(),
    ).sort((a, b) => a.price - b.price);

    const currencies = Array.from(
      new Set(uniquePrices.map((item) => item.currency).filter(Boolean)),
    );

    return {
      source: "ticombo_public_browser",
      eventUrl: normalizedEventUrl,
      currency: currencies.length === 1 ? currencies[0] : "MIXED",
      count: uniquePrices.length,
      prices: uniquePrices,
      lowestPrice: uniquePrices[0]?.price || null,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  getTicomboPublicMarketPrices,
  parseTicomboPrice,
  normalizeTicomboEventUrl,
};
