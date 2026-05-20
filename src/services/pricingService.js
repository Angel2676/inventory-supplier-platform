const pool = require("../db");

function applyRule(basePrice, rule) {
  let finalPrice = Number(basePrice);

  if (rule.markup_type === "percentage") {
    finalPrice = finalPrice + (finalPrice * Number(rule.markup_value)) / 100;
  }

  if (rule.markup_type === "fixed") {
    finalPrice = finalPrice + Number(rule.markup_value);
  }

  if (rule.min_price !== null && finalPrice < Number(rule.min_price)) {
    finalPrice = Number(rule.min_price);
  }

  if (rule.max_price !== null && finalPrice > Number(rule.max_price)) {
    finalPrice = Number(rule.max_price);
  }

  return Number(finalPrice.toFixed(2));
}

async function calculatePrice({ ticket, userId }) {
  let finalPrice = Number(ticket.price);

  const result = await pool.query(
    `
    SELECT *
    FROM pricing_rules
    WHERE is_active = true
    AND (
      event_id IS NULL OR event_id = $1
    )
    AND (
      category IS NULL OR category = $2
    )
    AND (
      partner_user_id IS NULL OR partner_user_id = $3
    )
    ORDER BY
      partner_user_id NULLS FIRST,
      event_id NULLS FIRST,
      category NULLS FIRST,
      id ASC
    `,
    [ticket.event_id, ticket.category, userId]
  );

  for (const rule of result.rows) {
    finalPrice = applyRule(finalPrice, rule);
  }

  return finalPrice;
}

module.exports = {
  calculatePrice
};