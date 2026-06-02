const express = require("express");

const {
  runMarketAnalysis,
} = require("../services/marketAnalysis/marketAnalysisService");

const router = express.Router();

router.post("/run", async (req, res) => {
  try {
    const { eventId, category, block, marketplaces } = req.body;

    if (!eventId) {
      return res.status(400).json({
        error: "eventId obbligatorio",
      });
    }

    const results = await runMarketAnalysis({
      eventId,
      category,
      block,
      marketplaces: Array.isArray(marketplaces) ? marketplaces : [],
    });

    return res.json({
      success: true,
      eventId,
      category: category || null,
      block: block || null,
      marketplaces: marketplaces || [],
      results,
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
