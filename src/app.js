const notificationsRoutes = require("./routes/notifications");
const analyticsRoutes = require("./routes/analytics");
const inventoryStatusRoutes = require("./routes/inventoryStatus");
const inventoryAlertsRoutes = require("./routes/inventoryAlerts");
const partnerEventAccessRoutes = require("./routes/partnerEventAccess");
const ticketRequestsRoutes = require("./routes/ticketRequests");
const usersRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const cors = require("cors");
const dashboardRoutes = require("./routes/dashboard");
const auditLogsRoutes = require("./routes/auditLogs");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");
const express = require("express");
require("dotenv").config();

const cleanupExpiredReservations = require("./services/reservationCleanup");

const eventsRoutes = require("./routes/events");
const ticketsRoutes = require("./routes/tickets");
const reservationsRoutes = require("./routes/reservations");

const app = express();

const cors = require("cors");

app.use(
  cors({
    origin: [
      "http://localhost:5175",
      "http://localhost:5173",
      "https://inventory-supplier-platform.vercel.app"
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/events", eventsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/ticket-requests", ticketRequestsRoutes);
app.use("/api/partner-event-access", partnerEventAccessRoutes);
app.use("/api/inventory-alerts", inventoryAlertsRoutes);
app.use("/api/inventory-status", inventoryStatusRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationsRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Inventory Supplier API",
    message: "Backend attivo correttamente"
  });
});

setInterval(() => {
  cleanupExpiredReservations();
}, 60000);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Inventory Supplier API running on port ${PORT}`);
});