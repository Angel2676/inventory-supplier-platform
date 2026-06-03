const express = require("express");
const pool = require("../db");
const {
  runMarketAnalysis,
} = require("../services/marketAnalysis/marketAnalysisService");

const router = express.Router();
router.get("/events", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        venue,
        city,
        event_date
      FROM events
      WHERE status = 'active'
      ORDER BY event_date ASC
    `);

    return res.json({
      success: true,
      events: result.rows,
    });
  } catch (error) {
    console.error("Market analysis events error:", error);

    return res.status(500).json({
      error: "Errore caricamento eventi",
      details: error.message,
    });
  }
});

router.get("/events/:eventId/categories", async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await pool.query(
      `
      SELECT DISTINCT
        category,
        COALESCE(block, '') AS block
      FROM tickets
      WHERE event_id = $1
        AND status = 'available'
      ORDER BY category ASC, block ASC
      `,
      [eventId],
    );

    return res.json({
      success: true,
      eventId: Number(eventId),
      categories: result.rows,
    });
  } catch (error) {
    console.error("Market analysis categories error:", error);

    return res.status(500).json({
      error: "Errore caricamento categorie",
      details: error.message,
    });
  }
});
router.post("/run", async (req, res) => {
  try {
    const { eventId, category, block, marketplaces } = req.body;

    if (!eventId) {
      return res.status(400).json({
        error: "eventId obbligatorio",
      });
    }

    const analysis = await runMarketAnalysis({
      eventId,
      category,
      block,
      marketplaces: Array.isArray(marketplaces) ? marketplaces : [],
    });

    return res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Market analysis error:", error);

    return res.status(500).json({
      error: "Errore durante l'analisi di mercato",
      details: error.message,
    });
  }
});

module.exports = router;
