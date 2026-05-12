import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
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
import CollapsibleSection from "./components/CollapsibleSection";

import { useAuth } from "./context/AuthContext";

function App() {
  const { isAuthenticated, user, logout } = useAuth();

  const isSuperAdmin = user?.role === "super_admin";

  const [stats, setStats] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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

  const resetMatch = window.location.pathname.match(
    /^\/reset-password\/(.+)$/
  );

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

  if (!isSuperAdmin) {
    return (
      <div className="app-container partner-dashboard">
        <header className="topbar">
          <div>
            <h1>Partner Ticket Portal</h1>
            <p>
              {user?.company_name || user?.email} · Area Partner
            </p>
          </div>

          <button className="btn btn-delete" onClick={logout}>
            Logout
          </button>
        </header>

        {stats && <DashboardStats stats={stats} />}

        <CollapsibleSection
          title="Le tue notifiche"
          subtitle="Aggiornamenti su richieste, approvazioni e reservations"
          defaultOpen={true}
        >
          <NotificationCenter />
          <PartnerNotifications />
        </CollapsibleSection>

        <CollapsibleSection
          title="Inventory disponibile"
          subtitle="Consulta eventi, categorie, prezzi e disponibilità"
          defaultOpen={true}
        >
          <TicketsTable canEdit={false} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Richiedi tickets"
          subtitle="Invia una richiesta al super admin per approvazione"
          defaultOpen={true}
        >
          <CreateTicketRequestForm onCreated={loadStats} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Le tue richieste"
          subtitle="Controlla richieste pending, approvate o rifiutate"
          defaultOpen={true}
        >
          <TicketRequestsTable />
        </CollapsibleSection>

        <CollapsibleSection
          title="Le tue reservations"
          subtitle="Consulta le reservations confermate o scadute"
        >
          <ReservationsTable />
        </CollapsibleSection>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="topbar">
        <div>
          <h1>Inventory Supplier Dashboard</h1>
          <p>
            {user?.company_name || user?.email} · {user?.role}
          </p>
        </div>

        <button className="btn btn-delete" onClick={logout}>
          Logout
        </button>
      </header>

      {stats && <DashboardStats stats={stats} />}

      <AdminPendingAlert />

      <CollapsibleSection
        title="Notification Center"
        subtitle="Notifiche operative, richieste approvate/rifiutate e alert"
        defaultOpen={true}
      >
        <NotificationCenter />
      </CollapsibleSection>

      <CollapsibleSection
        title="Business Analytics"
        subtitle="KPI, valore stock, approval rate, top events e top partners"
        defaultOpen={true}
      >
        <BusinessAnalytics />
      </CollapsibleSection>

      <CollapsibleSection
        title="Event Management"
        subtitle="Crea, modifica e gestisci eventi, venue, status e visibility"
      >
        <EventManagement />
      </CollapsibleSection>

      <CollapsibleSection
        title="Create Inventory"
        subtitle="Crea nuovi tickets o carica inventory tramite CSV"
      >
        <CreateTicketForm onCreated={loadStats} />
        <CsvUpload onUploaded={loadStats} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Tickets Inventory"
        subtitle="Stock disponibile, prezzi, soglie low stock e ricerca inventory"
        defaultOpen={true}
      >
        <TicketsTable canEdit={true} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Inventory Intelligence"
        subtitle="Disponibilità reale, pending, reserved, confirmed e health status"
      >
        <LowStockAlerts />
        <InventoryStatusTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="Create Reservation"
        subtitle="Crea reservation dirette"
      >
        <CreateReservationForm onCreated={loadStats} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Ticket Requests"
        subtitle="Richieste partner pending, approved o rejected"
        defaultOpen={true}
      >
        <TicketRequestsTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="Reservations"
        subtitle="Reservation confirmed, reserved, expired e storico operativo"
      >
        <ReservationsTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="System Activity Timeline"
        subtitle="Timeline realtime delle operazioni principali"
      >
        <SystemActivityTimeline />
      </CollapsibleSection>

      <CollapsibleSection
        title="Users & Roles"
        subtitle="Gestione utenti, approvazioni partner e ruoli RBAC"
      >
        <UsersTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="Partner Event Access"
        subtitle="Assegna eventi visibili ai singoli partner"
      >
        <PartnerEventAccessTable />
      </CollapsibleSection>

      <CollapsibleSection
        title="Audit Logs"
        subtitle="Log tecnico completo delle operazioni di sistema"
      >
        <AuditLogsTable />
      </CollapsibleSection>
    </div>
  );
}

export default App; 