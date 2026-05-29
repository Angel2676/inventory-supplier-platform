const axios = require("axios");

async function getPublicEventHtml(publicUrl) {
  const response = await axios.get(publicUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  return response.data;
}

async function getPublicLowestPriceForCategory(publicUrl, categoryId) {
  const html = await getPublicEventHtml(publicUrl);

  const text = String(html || "")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\n/g, "")
    .replace(/\\t/g, "");

  const pattern = new RegExp(
    `"id":${categoryId}[\\s\\S]{0,1000}?"category_id":"${categoryId}"[\\s\\S]{0,1000}?"name":"([^"]+)"[\\s\\S]{0,1000}?"min_price":([0-9.]+)`,
  );

  const match = text.match(pattern);

  if (!match) {
    return null;
  }

  return {
    id: Number(categoryId),
    category_id: String(categoryId),
    category_name: match[1],
    min_price: Number(match[2]),
  };
}

module.exports = {
  getPublicEventHtml,
  getPublicLowestPriceForCategory,
};
