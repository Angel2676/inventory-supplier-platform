function PartnerHero({ user, stats }) {
  return (
    <section className="partner-hero">
      <div>
        <span className="partner-hero-label">SportManiaTravel Partner Portal</span>

        <h1>
          Welcome back,{" "}
          {user?.contact_name || user?.company_name || "Partner"}
        </h1>

        <p>
          Access live inventory, request tickets in real time and manage your
          confirmed reservations from one premium dashboard.
        </p>
      </div>

      <div className="partner-hero-stats">
        <div>
          <strong>{stats?.total_tickets || 0}</strong>
          <span>Live tickets</span>
        </div>

        <div>
          <strong>{stats?.active_reservations || 0}</strong>
          <span>Reservations</span>
        </div>

        <div>
          <strong>{stats?.pending_requests || 0}</strong>
          <span>Pending requests</span>
        </div>
      </div>
    </section>
  );
}

export default PartnerHero;