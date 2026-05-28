const axios = require("axios");

const url =
  "https://www.gigsberg.com/concert-tickets/pop/backstreet-boys-tickets/show-209998";

async function main() {
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const html = response.data;
  const keywords = [
    "313.01",
    "Stehplatz",
    "category_id",
    "price",
    "ticket",
    "available",
  ];

  for (const keyword of keywords) {
    const idx = html.indexOf(keyword);
    console.log("KEYWORD", keyword, "INDEX", idx);

    if (idx !== -1) {
      console.log(html.slice(Math.max(0, idx - 500), idx + 1000));
    }
  }

  console.log("HTML length:", html.length);

  const priceMatches = [
    ...html.matchAll(
      /(?:€|&euro;)?\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:€|EUR)?/g,
    ),
  ]
    .map((m) => m[1])
    .map((v) => Number(String(v).replace(",", ".")))
    .filter((v) => v > 20 && v < 5000);

  console.log(
    "Prices found:",
    [...new Set(priceMatches)].sort((a, b) => a - b),
  );

  const stehplatzIndex = html.toLowerCase().indexOf("stehplatz");
  console.log("Stehplatz found:", stehplatzIndex !== -1);

  if (stehplatzIndex !== -1) {
    const snippet = html.slice(
      Math.max(0, stehplatzIndex - 1000),
      stehplatzIndex + 3000,
    );
    console.log("Stehplatz snippet:");
    console.log(snippet);
  }
}

main().catch((err) => {
  console.error(
    "Error:",
    err.response?.status,
    err.response?.data || err.message,
  );
});
