const { calculateSafePrice } = require("./src/services/priceCheckerService");

const result = calculateSafePrice({
  currentPrice: 250,
  marketLowestPrice: 210,
  minPrice: 220,
  undercutAmount: 0.01,
});

console.log(result);
