const {
  getSportEvents365TicketsByEventId,
} = require("./sportevents365Api");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getMainCategoryName(value) {
  return String(value || "")
    .split("|")[0]
    .trim();
}

async function getSportEvents365LowestMarketPrice({
  remoteEventId,
  remoteCategoryName,
}) {
  if (!remoteEventId) {
    throw new Error("remoteEventId mancante per SportEvents365 market scanner");
  }

  const data = await getSportEvents365TicketsByEventId(remoteEventId);
  const tickets = data?.data || [];

  const mainCategory = getMainCategoryName(remoteCategoryName);
  const normalizedMainCategory = normalize(mainCategory);

  const matchedTickets = tickets.filter((ticket) => {
    const categoryName = ticket.categoryName || "";
    const ticketMainCategory = getMainCategoryName(categoryName);

    return normalize(ticketMainCategory) === normalizedMainCategory;
  });

  const prices = matchedTickets
    .map((ticket) => Number(ticket.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);

  return {
    lowestPrice: prices[0] || null,
    prices,
    matchedCount: matchedTickets.length,
    remoteEventId,
    remoteCategoryName,
    mainCategory,
    source: "sportevents365_api_tickets",
  };
}

module.exports = {
  getSportEvents365LowestMarketPrice,
};
