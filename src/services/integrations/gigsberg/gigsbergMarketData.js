const axios = require("axios");

async function getGigsbergMarketDataHtml(eventId) {
  if (!eventId) {
    throw new Error("eventId obbligatorio per getGigsbergMarketDataHtml");
  }

  const cookie = process.env.GIGSBERG_WEB_COOKIE;

  if (!cookie) {
    throw new Error("GIGSBERG_WEB_COOKIE mancante nel file .env");
  }

  const response = await axios.get(
    `https://www.gigsberg.com/sellers/dashboard/market-data?event_id=${eventId}`,
    {
      headers: {
        Accept: "text/html, */*; q=0.01",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.gigsberg.com/sellers/dashboard",
        Cookie: cookie,
      },
    },
  );

  return JSON.stringify(response.data);
}

function parseMarketPricesFromHtml(html, wantedCategoryName) {
  const prices = [];

  const listingBlocks = String(html).split('class="the_listing_market');

  for (const block of listingBlocks) {
    const categoryMatch = block.match(
      /<span class=\\"table_cell cat1\\"[^>]*>\s*([^<]+?)\s*<\\\/span>/,
    );

    const category = categoryMatch
      ? categoryMatch[1].replace(/\\n/g, "").trim()
      : "";

    // filtro categoria temporaneamente disattivato per debug

    const priceMatch = block.match(
      /the_webprice[\s\S]*?value=['"]([0-9.]+)['"]/,
    );

    if (!priceMatch) continue;

    const price = Number(priceMatch[1]);

    const idMatch = block.match(/data-id=\\"?([0-9]+)\\"?/);

    const quantityMatch = block.match(/data-quantity=\\"?([0-9]+)\\"?/);

    const listingId = idMatch ? idMatch[1] : null;

    const quantity = quantityMatch ? Number(quantityMatch[1]) : null;

    if (price > 0) {
      prices.push({
        listingId,
        category,
        quantity,
        price,
      });
    }
  }

  return prices;
}

module.exports = {
  getGigsbergMarketDataHtml,
  parseMarketPricesFromHtml,
};
