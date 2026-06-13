const { chromium } = require("playwright");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function parsePrice(line) {
  const match = String(line || "").match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*€/);
  if (!match) return null;

  return Number(match[1].replace(",", "."));
}

async function getTicomboPublicMarketPrice({
  publicUrl,
  category,
  ownPublicPrice = null,
  headless = true,
}) {
  if (!publicUrl) {
    throw new Error("publicUrl mancante");
  }

  const browser = await chromium.launch({ headless });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    });

    const url = publicUrl.includes("currency=EUR")
      ? publicUrl
      : `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}currency=EUR&country=IT`;

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    await page.waitForTimeout(8000);

    const text = await page.locator("body").innerText();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const targetCategory = normalize(category);
    const prices = [];

    for (let i = 0; i < lines.length; i++) {
      if (normalize(lines[i]) !== targetCategory) continue;

      const block = lines.slice(i, i + 20);

      for (const line of block) {
        const price = parsePrice(line);
        if (!price) continue;

        prices.push(price);
        break;
      }
    }

    const own = ownPublicPrice ? Number(ownPublicPrice) : null;

    const competitorPrices = prices.filter((price) => {
      if (!own) return true;
      return Math.abs(price - own) > 0.01;
    });

    competitorPrices.sort((a, b) => a - b);

    return {
      source: "ticombo_public_browser",
      category,
      publicUrl: url,
      prices,
      ownPublicPrice: own,
      lowestPrice: competitorPrices[0] || null,
      matchedCount: competitorPrices.length,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  getTicomboPublicMarketPrice,
};
