import { useMemo, useState } from "react";

function TeamSelectionCards({
  events = [],
  tickets = [],
  selectedTeam = "",
  onSelectTeam
}) {
  const [teamSearch, setTeamSearch] = useState("");

  const TEAM_THEMES = {
    Inter: "team-inter",
    Milan: "team-milan",
    Juventus: "team-juventus",
    Napoli: "team-napoli",
    Roma: "team-roma",
    Lazio: "team-lazio",
    Atalanta: "team-atalanta",
    Fiorentina: "team-fiorentina",
    Torino: "team-torino"
  };

  function getTeamTheme(teamName) {
    return TEAM_THEMES[teamName] || "team-default";
  }

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
    <div className="team-cards-section">
      <div className="team-cards-header">
        <div>
          <span>Choose your team</span>
          <h3>Browse inventory by team</h3>
        </div>
      </div>

      <div className="team-selector-panel">
        <input
          type="text"
          placeholder="Search team..."
          value={teamSearch}
          onChange={(e) => setTeamSearch(e.target.value)}
        />

        <select
          value={selectedTeam}
          onChange={(e) => onSelectTeam(e.target.value)}
        >
          <option value="">Select a team</option>

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
            Reset team
          </button>
        )}
      </div>

      {selectedTeamData && (
        <div className="team-cards-grid single-team-grid">
          <button
            type="button"
            className={`team-card team-card-premium ${getTeamTheme(
              selectedTeamData.name
            )}`}
            onClick={() => onSelectTeam(selectedTeamData.name)}
          >
            <div className="team-card-top">
              <div className="team-card-logo-wrap premium-logo">
                {selectedTeamData.logo_url ? (
                  <img
                    src={selectedTeamData.logo_url}
                    alt={selectedTeamData.name}
                    className="team-card-logo"
                  />
                ) : (
                  <span>
                    {selectedTeamData.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <span className="team-card-badge">Selected Team</span>
            </div>

            <div className="team-card-main">
              <h4>{selectedTeamData.name}</h4>
              <p>{selectedTeamData.events.length} events available</p>
            </div>

            <div className="team-card-footer premium-footer">
              <span>
                <strong>{getAvailableQuantity(selectedTeamData)}</strong>{" "}
                available
              </span>

              <span>
                {getStartingPrice(selectedTeamData)
                  ? `From €${getStartingPrice(selectedTeamData).toFixed(2)}`
                  : "Price TBC"}
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default TeamSelectionCards;