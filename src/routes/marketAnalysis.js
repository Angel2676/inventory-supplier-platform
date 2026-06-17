const express = require("express");
const pool = require("../db");
const {
  runMarketAnalysis,
} = require("../services/marketAnalysis/marketAnalysisService");

const router = express.Router();
const { runRepricingJob } = require("../jobs/repricingJob");
const {
  runGigsbergMarketScannerJob,
} = require("../jobs/gigsbergMarketScannerJob");
const {
  runTicomboMarketScannerJob,
} = require("../jobs/ticomboMarketScannerJob");
const { runMarketplaceSyncJob } = require("../jobs/marketplaceSyncJob");

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
router.post("/jobs/run", async (req, res) => {
  const { job, eventId, marketplace } = req.body;

  const supportedJobs = [
    "ticombo",
    "gigsberg",
    "sportevents365",
    "repricing",
    "sync",
    "all",
    "event",
  ];

  if (!supportedJobs.includes(job)) {
    return res.status(400).json({
      success: false,
      error: "Job non supportato",
    });
  }

  if (job === "event") {
    const selectedEventId = Number(eventId);
    const selectedMarketplace = String(marketplace || "").toLowerCase();

    if (!selectedEventId) {
      return res.status(400).json({
        success: false,
        error: "eventId obbligatorio",
      });
    }

    if (!["ticombo", "gigsberg", "sportevents365"].includes(selectedMarketplace)) {
      return res.status(400).json({
        success: false,
        error: "marketplace evento non supportato",
      });
    }

    setImmediate(async () => {
      try {
        console.log("Manual event marketplace job started:", {
          eventId: selectedEventId,
          marketplace: selectedMarketplace,
        });

        if (selectedMarketplace === "ticombo") {
          await runTicomboMarketScannerJob({ eventId: selectedEventId });
          await runRepricingJob({
            marketplaces: ["ticombo"],
            eventId: selectedEventId,
          });
        } else if (selectedMarketplace === "gigsberg") {
          await runGigsbergMarketScannerJob({ eventId: selectedEventId });
          await runRepricingJob({
            marketplaces: ["gigsberg"],
            eventId: selectedEventId,
          });
        } else if (selectedMarketplace === "sportevents365") {
          await runRepricingJob({
            marketplaces: ["sportevents365"],
            eventId: selectedEventId,
          });
        }

        console.log("Manual event marketplace job completed:", {
          eventId: selectedEventId,
          marketplace: selectedMarketplace,
        });
      } catch (error) {
        console.error("Manual event marketplace job failed:", {
          eventId: selectedEventId,
          marketplace: selectedMarketplace,
          error,
        });
      }
    });

    return res.json({
      success: true,
      job,
      eventId: selectedEventId,
      marketplace: selectedMarketplace,
      message: `Job evento ${selectedEventId} per ${selectedMarketplace} avviato in background`,
    });
  }

  setImmediate(async () => {
    try {
      console.log(`Manual marketplace job started: ${job}`);

      if (job === "ticombo") {
        await runTicomboMarketScannerJob();
        await runRepricingJob({ marketplaces: ["ticombo"] });
      } else if (job === "gigsberg") {
        await runGigsbergMarketScannerJob();
        await runRepricingJob({ marketplaces: ["gigsberg"] });
      } else if (job === "sportevents365") {
        await runRepricingJob({ marketplaces: ["sportevents365"] });
      } else if (job === "repricing") {
        await runRepricingJob();
      } else if (job === "sync") {
        await runMarketplaceSyncJob();
      } else if (job === "all") {
        await runGigsbergMarketScannerJob();
        await runTicomboMarketScannerJob();
        await runRepricingJob();
        await runMarketplaceSyncJob();
      }

      console.log(`Manual marketplace job completed: ${job}`);
    } catch (error) {
      console.error(`Manual marketplace job failed: ${job}`, error);
    }
  });

  return res.json({
    success: true,
    job,
    message: `Job ${job} avviato in background`,
  });
});

module.exports = router;
