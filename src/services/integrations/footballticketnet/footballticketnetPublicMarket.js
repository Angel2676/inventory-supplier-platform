const { chromium } = require("playwright");

function parsePrice(value) {
  if (!value) return null;

  const raw = String(value).trim();

  let cleaned = raw.replace(/[^\d.,]/g, "");

  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    cleaned = cleaned.replace(",", ".");
  }

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
      line.match(/(?:€|EUR|US\$|\$|£)\s*[0-9]{2,5}(?:[.,][0-9]{2})?/gi) || [];

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

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    });

    await page.goto(publicUrl, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    await page.waitForTimeout(3000);

    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".inner_price[data-price]"))
        .map((el) => {
          const rawPrice =
            el.getAttribute("data-price") ||
            el.getAttribute("data-price_for_filter");

          const categoryName =
            el.querySelector(".category_name")?.innerText?.trim() ||
            el.querySelector(".extra_information_icon")?.innerText?.trim() ||
            "";

          const infoText = el.innerText || "";

          return {
            rawPrice,
            price: Number(rawPrice),
            category: categoryName,
            block: el.getAttribute("data-block") || "",
            ticketId: el.getAttribute("data-ticket") || "",
            remoteCategoryId: el.getAttribute("data-category") || "",
            maxQty: el.getAttribute("data-max-qty") || "",
            qtyList: el.getAttribute("data-qty-list") || "",
            ticketType: el.getAttribute("data-ticket-type") || "",
            exchange: el.getAttribute("data-exchange") || "",
            rawText: infoText.replace(/\s+/g, " ").trim(),
          };
        })
        .filter((row) => Number.isFinite(row.price) && row.price > 10);
    });

    const categoryFilter = normalizeText(category);
    const blockFilter = normalizeText(block);

    const filteredRows = rows.filter((row) => {
      const rowCategory = normalizeText(row.category);
      const rowBlock = normalizeText(row.block);
      const rowText = normalizeText(row.rawText);

      const matchesCategory =
        !categoryFilter ||
        rowCategory === categoryFilter ||
        rowCategory.includes(categoryFilter) ||
        categoryFilter.includes(rowCategory) ||
        rowText.includes(categoryFilter);

      const matchesBlock =
        !blockFilter ||
        rowBlock === blockFilter ||
        rowBlock.includes(blockFilter) ||
        rowText.includes(blockFilter);

      return matchesCategory && matchesBlock;
    });

    const finalRows = filteredRows.map((row) => ({
      marketplace: "footballticketnet",
      category: row.category || category || null,
      block: row.block || block || null,
      normalizedCategory: normalizeFootballTicketNetCategory(
        row.category || category,
        row.block || block,
      ),
      price: Number(row.price),
      currency: "EUR",
      rawPrice: row.rawPrice,
      ticketId: row.ticketId,
      remoteCategoryId: row.remoteCategoryId,
      maxQty: row.maxQty,
      qtyList: row.qtyList,
      ticketType: row.ticketType,
      exchange: row.exchange,
      rawText: row.rawText,
    }));

    console.log("FootballTicketNet public market:", {
      publicUrl,
      category,
      block,
      rowsFound: finalRows.length,
      lowestPrice: finalRows.length
        ? Math.min(...finalRows.map((row) => row.price))
        : null,
    });

    return finalRows.sort((a, b) => a.price - b.price);
  } finally {
    await browser.close();
  }
}

module.exports = {
  getVisibleFootballTicketNetPrices,
  normalizeFootballTicketNetCategory,
  extractFootballTicketNetRowsFromText,
};
