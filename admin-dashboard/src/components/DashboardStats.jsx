function DashboardStats({ stats }) {
  return (
    <div className="stats-grid">

      <div className="stat-card">
        <h2>{stats.events.total_events}</h2>
        <p>Eventi attivi</p>
      </div>

      <div className="stat-card">
        <h2>{stats.tickets.total_tickets}</h2>
        <p>Tickets totali</p>
      </div>

      <div className="stat-card">
        <h2>{stats.tickets.available_quantity}</h2>
        <p>Disponibilità reale</p>
      </div>

      <div className="stat-card">
        <h2>
          € {stats.tickets.available_stock_value}
        </h2>
        <p>Valore stock disponibile</p>
      </div>

      <div className="stat-card">
        <h2>
          {stats.reservations.reserved_count}
        </h2>
        <p>Prenotazioni attive</p>
      </div>

      <div className="stat-card">
        <h2>
          {stats.reservations.confirmed_count}
        </h2>
        <p>Prenotazioni confermate</p>
      </div>

    </div>
  );
}

export default DashboardStats;