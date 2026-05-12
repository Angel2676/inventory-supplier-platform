import { useEffect, useState } from "react";

import api from "./api";

import DashboardStats from "./components/DashboardStats";
import TicketsTable from "./components/TicketsTable";
import ReservationsTable from "./components/ReservationsTable";
import AuditLogsTable from "./components/AuditLogsTable";
import CsvUpload from "./components/CsvUpload";
import CreateTicketForm from "./components/CreateTicketForm";
import CreateReservationForm from "./components/CreateReservationForm";
import CreateTicketRequestForm from "./components/CreateTicketRequestForm";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import UsersTable from "./components/UsersTable";
import TicketRequestsTable from "./components/TicketRequestsTable";
import PartnerNotifications from "./components/PartnerNotifications";
import AdminPendingAlert from "./components/AdminPendingAlert";
import PartnerEventAccessTable from "./components/PartnerEventAccessTable";
import LowStockAlerts from "./components/LowStockAlerts";
import InventoryStatusTable from "./components/InventoryStatusTable";
import BusinessAnalytics from "./components/BusinessAnalytics";
import NotificationCenter from "./components/NotificationCenter";
import EventManagement from "./components/EventManagement";
import SystemActivityTimeline from "./components/SystemActivityTimeline";
import Sidebar from "./components/Sidebar";

import { useAuth } from "./context/AuthContext";

function App() {
  const { isAuthenticated, user, logout } = useAuth();

  const isSuperAdmin = user?.role === "super_admin";

  const [stats, setStats] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [activeSection, setActiveSection] = useState("tickets");

  const resetMatch = window.location.pathname.match(
    /^\/reset-password\/(.+)$/
  );

  async function loadStats() {
    try {
      const response = await api.get("/api/dashboard/stats");
      setStats(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;

    loadStats();

    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (user.role === "super_admin") {
      setActiveSection("analytics");
    } else {
      setActiveSection("tickets");
    }
  }, [isAuthenticated, user]);

  if (resetMatch) {
    return (
      <ResetPasswordPage
        token={resetMatch[1]}
        onBackToLogin={() => {
          window.history.pushState({}, "", "/");
          window.location.reload();
        }}
      />
    );
  }

  if (!isAuthenticated) {
    if (showForgotPassword) {
      return (
        <ForgotPasswordPage
          onBackToLogin={() => setShowForgotPassword(false)}
        />
      );
    }

    if (showRegister) {
      return (
        <RegisterPage
          onBackToLogin={() => setShowRegister(false)}
        />
      );
    }

    return (
      <LoginPage
        onShowRegister={() => setShowRegister(true)}
        onShowForgotPassword={() => setShowForgotPassword(true)}
      />
    );
  }

  function renderAdminSection() {
    switch (activeSection) {
      case "notifications":
        return (
          <>
            <AdminPendingAlert />
            <NotificationCenter />
          </>
        );

      case "analytics":
        return (
          <>
            {stats && <DashboardStats stats={stats} />}
            <BusinessAnalytics />
          </>
        );

      case "events":
        return <EventManagement />;

      case "inventory-create":
        return (
          <>
            <CreateTicketForm onCreated={loadStats} />
            <CsvUpload onUploaded={loadStats} />
          </>
        );

      case "tickets":
        return <TicketsTable canEdit={true} />;

      case "inventory-intelligence":
        return (
          <>
            <LowStockAlerts />
            <InventoryStatusTable />
          </>
        );

      case "reservation-create":
        return <CreateReservationForm onCreated={loadStats} />;

      case "requests":
        return <TicketRequestsTable />;

      case "reservations":
        return <ReservationsTable />;

      case "timeline":
        return <SystemActivityTimeline />;

      case "users":
        return <UsersTable />;

      case "access":
        return <PartnerEventAccessTable />;

      case "audit":
        return <AuditLogsTable />;

      default:
        return <BusinessAnalytics />;
    }
  }

  function renderPartnerSection() {
    switch (activeSection) {
      case "notifications":
        return (
          <>
            <NotificationCenter />
            <PartnerNotifications />
          </>
        );

      case "tickets":
        return (
          <>
            {stats && <DashboardStats stats={stats} />}
            <TicketsTable canEdit={false} />
          </>
        );

      case "request-create":
        return <CreateTicketRequestForm onCreated={loadStats} />;

      case "requests":
        return <TicketRequestsTable />;

      case "reservations":
        return <ReservationsTable />;

      default:
        return <TicketsTable canEdit={false} />;
    }
  }

  return (
    <div className="dashboard-shell">
      <Sidebar
        user={user}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        logout={logout}
      />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>
              {isSuperAdmin
                ? "Inventory Supplier Dashboard"
                : "Partner Ticket Portal"}
            </h1>

            <p>
              {user?.company_name || user?.email} · {user?.role}
            </p>
          </div>
        </header>

        <div className="dashboard-content">
          {isSuperAdmin
            ? renderAdminSection()
            : renderPartnerSection()}
        </div>
      </main>
    </div>
  );
}

export default App;