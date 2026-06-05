function normalizeFootballTicketNetCategory(category, block) {
  const text = `${category || ""} ${block || ""}`
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

async function analyzeFootballTicketNetMarket({ eventId, category, block }) {
  const normalizedCategory = normalizeFootballTicketNetCategory(
    category,
    block,
  );

  return {
    marketplace: "footballticketnet",
    eventId,
    category: category || null,
    block: block || null,
    normalizedCategory,
    lowestPrice: null,
    highestPrice: null,
    averagePrice: null,
    listingsCount: 0,
    currency: "EUR",
    rows: [],
    status: "scraper_not_implemented_yet",
  };
}

module.exports = {
  analyzeFootballTicketNetMarket,
  normalizeFootballTicketNetCategory,
};
