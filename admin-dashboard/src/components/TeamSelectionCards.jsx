function TeamSelectionCards({ events = [], tickets = [], onSelectTeam }) {
  const teamsMap = new Map();

  events.forEach((event) => {
    if (!event.team_name) return;

    const existing = teamsMap.get(event.team_name) || {
      name: event.team_name,
      logo_url: event.team_logo_url,
      events: [],
      tickets: []
    };

    const eventTickets = tickets.filter(
      (ticket) => Number(ticket.event_id) === Number(event.id)
    );

    existing.events.push(event);
    existing.tickets.push(...eventTickets);

    if (!existing.logo_url && event.team_logo_url) {
      existing.logo_url = event.team_logo_url;
    }

    teamsMap.set(event.team_name, existing);
  });

  const teams = Array.from(teamsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  if (teams.length === 0) return null;

  function getAvailableQuantity(team) {
    return team.tickets.reduce(
      (sum, ticket) => sum + Number(ticket.available_quantity || 0),
      0
    );
  }

  function getStartingPrice(team) {
    const prices = team.tickets
      .map((ticket) => Number(ticket.final_price || ticket.price || 0))
      .filter((price) => price > 0);

    if (prices.length === 0) return null;

    return Math.min(...prices);
  }

  return (
    <div className="team-cards-section">
      <div className="team-cards-header">
        <div>
          <span>Choose your team</span>
          <h3>Browse inventory by team</h3>
        </div>
      </div>

      <div className="team-cards-grid">
        {teams.map((team) => {
          const available = getAvailableQuantity(team);
          const startingPrice = getStartingPrice(team);

          return (
            <button
              key={team.name}
              type="button"
              className="team-card"
              onClick={() => onSelectTeam(team.name)}
            >
              <div className="team-card-logo-wrap">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={team.name}
                    className="team-card-logo"
                  />
                ) : (
                  <span>{team.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>

              <div>
                <h4>{team.name}</h4>
                <p>{team.events.length} events</p>
              </div>

              <div className="team-card-footer">
                <span>{available} available</span>
                <strong>
                  {startingPrice
                    ? `From €${startingPrice.toFixed(2)}`
                    : "Price TBC"}
                </strong>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TeamSelectionCards;