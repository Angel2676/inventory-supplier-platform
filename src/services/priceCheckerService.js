function calculateSafePrice({
  currentPrice,
  marketLowestPrice,
  minPrice,
  undercutAmount = 0.01,
}) {
  if (!marketLowestPrice || marketLowestPrice <= 0) {
    return {
      shouldUpdate: false,
      reason: "NO_MARKET_PRICE",
      suggestedPrice: null,
      finalPrice: currentPrice,
    };
  }

  if (!minPrice || minPrice <= 0) {
    return {
      shouldUpdate: false,
      reason: "MISSING_MIN_PRICE",
      suggestedPrice: null,
      finalPrice: currentPrice,
    };
  }

  const suggestedPrice = Number(
    (marketLowestPrice - undercutAmount).toFixed(2),
  );
  const finalPrice = Math.max(suggestedPrice, Number(minPrice));

  if (finalPrice >= Number(currentPrice)) {
    return {
      shouldUpdate: false,
      reason: "CURRENT_PRICE_ALREADY_OK",
      suggestedPrice,
      finalPrice,
    };
  }

  return {
    shouldUpdate: true,
    reason:
      finalPrice === Number(minPrice)
        ? "MIN_PRICE_PROTECTION_APPLIED"
        : "UNDERCUT_APPLIED",
    suggestedPrice,
    finalPrice,
  };
}

module.exports = {
  calculateSafePrice,
};
