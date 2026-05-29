const { chromium } = require("playwright");

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

async function getVisiblePublicPrices(publicUrl, options = {}) {
  const { headless = true, timeout = 45000 } = options;

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

    // 1. Chiude popup quantità biglietti
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

    // 2. Cambia valuta da USD a EUR
    try {
      const usdButton = page.getByRole("button", { name: /USD/i }).first();

      if (await usdButton.isVisible({ timeout: 5000 })) {
        await usdButton.click({ force: true });
        await page.waitForTimeout(1500);

        const eurOption = page.getByText("EUR", { exact: true }).first();

        if (await eurOption.isVisible({ timeout: 5000 })) {
          await eurOption.click({ force: true });
          console.log("Currency changed to EUR");
          await page.waitForTimeout(6000);
        } else {
          console.log("EUR option not visible");
        }
      } else {
        console.log("USD button not visible");
      }
    } catch (error) {
      console.log("Currency change to EUR failed:", error.message);
    }

    // 3. Legge i prezzi visibili dalla pagina
    await page.waitForTimeout(5000);

    const rawPrices = await page.evaluate(() => {
      const text = document.body?.innerText || "";

      const matches = text.match(/US\$\s*[0-9]+(?:[.,][0-9]{2})?/g) || [];

      return {
        textPreview: text.slice(0, 2500),
        matches,
      };
    });

    console.log("TEXT PREVIEW:", rawPrices.textPreview);
    console.log("RAW PRICE MATCHES:", rawPrices.matches);

    const parsedPrices = rawPrices.matches
      .map(parsePrice)
      .filter((price) => price !== null)
      .filter((price) => price > 10 && price < 10000);

    return [...new Set(parsedPrices)].sort((a, b) => a - b);
  } finally {
    await browser.close();
  }
}

async function getVisibleLowestPublicPrice(publicUrl, options = {}) {
  const prices = await getVisiblePublicPrices(publicUrl, options);

  if (!prices.length) {
    return null;
  }

  return {
    min_price: prices[0],
    prices,
  };
}

module.exports = {
  getVisiblePublicPrices,
  getVisibleLowestPublicPrice,
};
