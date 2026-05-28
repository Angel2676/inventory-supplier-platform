function calculateSafePrice({
  currentPrice,
  marketLowestPrice,
  minPrice,
  undercutAmount = 0.01,
}) {
  const current = Number(currentPrice || 0);
  const market = Number(marketLowestPrice || 0);
  const min = Number(minPrice || 0);
  const undercut = Number(undercutAmount || 0.01);

  if (!current || current <= 0) {
    return {
      shouldUpdate: false,
      reason: "NO_CURRENT_PRICE",
      suggestedPrice: null,
      finalPrice: current,
    };
  }

  if (!market || market <= 0) {
    return {
      shouldUpdate: false,
      reason: "NO_MARKET_PRICE",
      suggestedPrice: null,
      finalPrice: current,
    };
  }

  if (!min || min <= 0) {
    return {
      shouldUpdate: false,
      reason: "MISSING_MIN_PRICE",
      suggestedPrice: null,
      finalPrice: current,
    };
  }

  const suggestedPrice = Number((market - undercut).toFixed(2));

  if (suggestedPrice < min) {
    return {
      shouldUpdate: false,
      reason: "MIN_PRICE_PROTECTION",
      suggestedPrice,
      finalPrice: current,
    };
  }

  if (suggestedPrice === current) {
    return {
      shouldUpdate: false,
      reason: "NO_CHANGE",
      suggestedPrice,
      finalPrice: current,
    };
  }

  return {
    shouldUpdate: true,
    reason: suggestedPrice > current ? "REPRICE_UP" : "REPRICE_DOWN",
    direction: suggestedPrice > current ? "UP" : "DOWN",
    suggestedPrice,
    finalPrice: suggestedPrice,
  };
}

module.exports = {
  calculateSafePrice,
};
