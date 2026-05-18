const cron = require("node-cron");
const pool = require("../db");
const { calculateSafePrice } = require("../services/priceCheckerService");

async function runRepricingJob() {
  console.log("Repricing job started");

  const ticketsResult = await pool.query(`
    SELECT *
    FROM tickets
    WHERE auto_reprice_enabled = true
      AND status = 'available'
      AND available_quantity > 0
  `);

  const tickets = ticketsResult.rows;

  for (const ticket of tickets) {
    try {
      const marketLowestPrice = Number(ticket.last_market_price || 0);

      const priceCheck = calculateSafePrice({
        currentPrice: Number(ticket.price),
        marketLowestPrice,
        minPrice: Number(ticket.min_price),
        undercutAmount: Number(ticket.undercut_amount || 0.01),
      });

      if (!priceCheck.shouldUpdate) {
        await pool.query(
          `
          UPDATE tickets
          SET
            last_suggested_price = $1,
            last_reprice_at = NOW()
          WHERE id = $2
          `,
          [priceCheck.suggestedPrice, ticket.id],
        );

        console.log(`Ticket ${ticket.id}: no update - ${priceCheck.reason}`);
        continue;
      }

      await pool.query(
        `
        UPDATE tickets
        SET
          price = $1,
          last_suggested_price = $2,
          last_reprice_at = NOW()
        WHERE id = $3
        `,
        [priceCheck.finalPrice, priceCheck.suggestedPrice, ticket.id],
      );

      console.log(
        `Ticket ${ticket.id}: price updated from ${ticket.price} to ${priceCheck.finalPrice}`,
      );
    } catch (error) {
      console.error(`Ticket ${ticket.id}: repricing error`, error.message);
    }
  }

  console.log("Repricing job completed");
}

function startRepricingJob() {
  cron.schedule("*/10 * * * *", async () => {
    await runRepricingJob();
  });

  console.log("Automatic repricing job scheduled every 10 minutes");
}

module.exports = {
  runRepricingJob,
  startRepricingJob,
};
