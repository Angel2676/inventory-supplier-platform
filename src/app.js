require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { startRepricingJob } = require("./jobs/repricingJob");
const { startAutoPublishJob } = require("./jobs/autoPublishJob");
const app = express();
const marketplaceRoutes = require("./routes/marketplace");
const authRoutes = require("./routes/auth");
const eventsRoutes = require("./routes/events");
const ticketsRoutes = require("./routes/tickets");
const reservationsRoutes = require("./routes/reservations");
const dashboardRoutes = require("./routes/dashboard");
const auditLogsRoutes = require("./routes/auditLogs");
const usersRoutes = require("./routes/users");
const ticketRequestsRoutes = require("./routes/ticketRequests");
const partnerEventAccessRoutes = require("./routes/partnerEventAccess");
const inventoryAlertsRoutes = require("./routes/inventoryAlerts");
const inventoryStatusRoutes = require("./routes/inventoryStatus");
const analyticsRoutes = require("./routes/analytics");
const notificationsRoutes = require("./routes/notifications");
const { startMarketplaceSyncJob } = require("./jobs/marketplaceSyncJob");
const cleanupExpiredReservations = require("./services/reservationCleanup");
const webhooksRoutes = require("./routes/webhooks");
const PORT = process.env.PORT || 3000;
const {
  runGigsbergMarketScannerJob,
} = require("./jobs/gigsbergMarketScannerJob");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5175",
      "https://inventory-supplier-platform.vercel.app",
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Inventory Supplier API",
    message: "Backend attivo correttamente",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/ticket-requests", ticketRequestsRoutes);
app.use("/api/partner-event-access", partnerEventAccessRoutes);
app.use("/api/inventory-alerts", inventoryAlertsRoutes);
app.use("/api/inventory-status", inventoryStatusRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/webhooks", webhooksRoutes);

setInterval(() => {
  cleanupExpiredReservations();
}, 60000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  startRepricingJob();
  startMarketplaceSyncJob();
  startAutoPublishJob();
  runGigsbergMarketScannerJob();
});
