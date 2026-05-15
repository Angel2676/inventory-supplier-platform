import { useMemo, useState } from "react";

function TeamSelectionCards({
  events = [],
  tickets = [],
  selectedTeam = "",
  onSelectTeam
}) {
  const [teamSearch, setTeamSearch] = useState("");

  const teams = useMemo(() => {
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

    return Array.from(teamsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [events, tickets]);

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const selectedTeamData = teams.find((team) => team.name === selectedTeam);

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

  if (teams.length === 0) return null;

  return (
    <div className="team-selector-card">
      <div className="team-selector-header">
        <span>Step 2</span>
        <h3>Select team / artist / category</h3>
        <p>
          Search or select a team, artist or category to display available
          events and tickets.
        </p>
      </div>

      <div className="team-selector-controls">
        <input
          type="text"
          placeholder="Search Inter, Coldplay, Ferrari..."
          value={teamSearch}
          onChange={(e) => setTeamSearch(e.target.value)}
        />

        <select
          value={selectedTeam}
          onChange={(e) => onSelectTeam(e.target.value)}
        >
          <option value="">Select from list</option>

          {filteredTeams.map((team) => (
            <option key={team.name} value={team.name}>
              {team.name}
            </option>
          ))}
        </select>

        {selectedTeam && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setTeamSearch("");
              onSelectTeam("");
            }}
          >
            Reset
          </button>
        )}
      </div>

      {selectedTeamData && (
        <div className="selected-team-card">
          <div className="selected-team-logo">
            {selectedTeamData.logo_url ? (
              <img src={selectedTeamData.logo_url} alt={selectedTeamData.name} />
            ) : (
              <span>{selectedTeamData.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>

          <div>
            <h4>{selectedTeamData.name}</h4>
            <p>{selectedTeamData.events.length} events available</p>
          </div>

          <div className="selected-team-stats">
            <strong>{getAvailableQuantity(selectedTeamData)}</strong>
            <span>available tickets</span>
          </div>

          <div className="selected-team-stats">
            <strong>
              {getStartingPrice(selectedTeamData)
                ? `€${getStartingPrice(selectedTeamData).toFixed(2)}`
                : "TBC"}
            </strong>
            <span>starting price</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamSelectionCards;