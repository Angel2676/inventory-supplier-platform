import { useTranslation } from "react-i18next";

function Sidebar({ user, activeSection, setActiveSection, logout }) {
  const { t } = useTranslation();

  const isSuperAdmin = user?.role === "super_admin";

  const adminItems = [
    { key: "notifications", label: "Notifications" },
    { key: "analytics", label: "Analytics" },
    { key: "events", label: "Events" },
    { key: "inventory-create", label: "Create Inventory" },
    { key: "tickets", label: "Partner Inventory" },
    { key: "marketplace-hub", label: "Marketplace Hub" },
    { key: "inventory-intelligence", label: "Inventory Intelligence" },
    { key: "reservation-create", label: "Create Reservation" },
    { key: "requests", label: "Ticket Requests" },
    { key: "reservations", label: "Reservations" },
    { key: "timeline", label: "Activity Timeline" },
    { key: "users", label: "Users & Roles" },
    { key: "access", label: "Partner Access" },
    { key: "audit", label: "Audit Logs" }
  ];

  const partnerItems = [
    { key: "notifications", label: t("yourNotifications") },
    { key: "tickets", label: t("availableInventory") },
    { key: "requests", label: t("yourRequests") },
    { key: "reservations", label: t("yourReservations") }
  ];

  const items = isSuperAdmin ? adminItems : partnerItems;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">IS</div>

        <div>
          <h2>Inventory</h2>
          <p>Supplier Platform</p>
        </div>
      </div>

      <div className="sidebar-user">
        <strong>{user?.company_name || user?.email}</strong>
        <span>{user?.role}</span>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.key}
            className={
              activeSection === item.key
                ? "sidebar-link active"
                : "sidebar-link"
            }
            type="button"
            onClick={() => setActiveSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button className="sidebar-logout" onClick={logout}>
        Logout
      </button>
    </aside>
  );
}

export default Sidebar;
