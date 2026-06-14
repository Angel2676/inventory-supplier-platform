const { chromium } = require("playwright");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(line) {
  const match = String(line || "").match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*€/);
  if (!match) return null;

  return Number(match[1].replace(",", "."));
}

function extractPricesFromLines(lines, category) {
  const targetCategory = normalize(category);
  const prices = [];

  for (let i = 0; i < lines.length; i++) {
    const line = normalize(lines[i]);

    if (line !== targetCategory) continue;

    const block = lines.slice(i, i + 20);

    for (const blockLine of block) {
      const price = parsePrice(blockLine);
      if (!price) continue;

      prices.push(price);
      break;
    }
  }

  return prices;
}

async function getBodyLines(page) {
  const text = await page.locator("body").innerText();

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function tryActivateCategory(page, category) {
  const targetCategory = String(category || "").trim();

  if (!targetCategory) return false;

  const escaped = targetCategory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const candidates = [
    page
      .locator("button", {
        hasText: new RegExp(
          `^${escaped}\\s*(\$begin:math:text$\\\\d\+\\$end:math:text$)?$`,
          "i",
        ),
      })
      .first(),
    page
      .locator("label", {
        hasText: new RegExp(
          `^${escaped}\\s*(\$begin:math:text$\\\\d\+\\$end:math:text$)?$`,
          "i",
        ),
      })
      .first(),
    page
      .locator("[role='button']", {
        hasText: new RegExp(
          `^${escaped}\\s*(\$begin:math:text$\\\\d\+\\$end:math:text$)?$`,
          "i",
        ),
      })
      .first(),
    page
      .locator("input[type='checkbox']")
      .locator(
        `xpath=following-sibling::*[contains(normalize-space(.), "${targetCategory}")]`,
      )
      .first(),
  ];

  for (const candidate of candidates) {
    try {
      if ((await candidate.count()) === 0) continue;
      if (!(await candidate.isVisible().catch(() => false))) continue;

      await candidate.evaluate((el) => {
        el.scrollIntoView({ block: "center", inline: "center" });
      });

      await page.waitForTimeout(500);

      await candidate.evaluate((el) => {
        el.click();
      });

      await page.waitForTimeout(5000);

      return true;
    } catch (error) {
      console.log("Ticombo category click failed:", {
        category: targetCategory,
        message: error.message,
      });
    }
  }

  return false;
}

async function scrollToLoadMore(page) {
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(1500);
  }
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

    let lines = await getBodyLines(page);
    let prices = extractPricesFromLines(lines, category);
    let categoryActivated = false;

    if (prices.length === 0) {
      await scrollToLoadMore(page);
      lines = await getBodyLines(page);
      prices = extractPricesFromLines(lines, category);
    }

    if (prices.length === 0) {
      categoryActivated = await tryActivateCategory(page, category);

      if (categoryActivated) {
        await scrollToLoadMore(page);

        lines = await getBodyLines(page);

        prices = extractPricesFromLines(lines, category);
      }
    }

    const own = ownPublicPrice ? Number(ownPublicPrice) : null;

    const competitorPrices = prices.filter((price) => {
      if (!own) return true;
      return Math.abs(price - own) > 1.5;
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
      categoryActivated,
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  getTicomboPublicMarketPrice,
};
