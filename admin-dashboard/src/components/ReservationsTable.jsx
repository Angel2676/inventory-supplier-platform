import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const EVENT_TYPES = [
  {
    value: "football",
    label: "Calcio",
    subcategories: [
      "Serie A",
      "Premier League",
      "La Liga",
      "Bundesliga",
      "Ligue 1",
      "Champions League",
      "Europa League",
      "Conference League",
      "Nazionali",
      "Altro calcio"
    ]
  },
  {
    value: "concert",
    label: "Concerti",
    subcategories: [
      "Concerti italiani",
      "Concerti internazionali"
    ]
  },
  {
    value: "formula_1",
    label: "Formula 1",
    subcategories: [
      "Grand Prix"
    ]
  }
];

function ReservationsTable() {
  const { user } = useAuth();

  const [reservations, setReservations] = useState([]);
  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");

  const [sortDirection, setSortDirection] = useState("asc");
  const [error, setError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  async function loadReservations() {
    try {
      const response = await api.get("/api/reservations");

      setReservations(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento prenotazioni");
    }
  }

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleString();
  }

  function getTypeLabel(type) {
    return (
      EVENT_TYPES.find((item) => item.value === type)?.label || "-"
    );
  }

  function getSubcategories(type) {
    return (
      EVENT_TYPES.find((item) => item.value === type)
        ?.subcategories || []
    );
  }

  function getTotalPrice(reservation) {
    return (
      Number(reservation.price || 0) *
      Number(reservation.quantity || 0)
    ).toFixed(2);
  }

  function getEventTime(value) {
    if (!value) return Number.MAX_SAFE_INTEGER;

    return new Date(value).getTime();
  }

  const availableSubcategories = typeFilter
    ? getSubcategories(typeFilter)
    : [];

  const filteredReservations = reservations
    .filter((reservation) => {
      const text = `
        ${reservation.reservation_code || ""}
        ${reservation.event_name || ""}
        ${reservation.event_date || ""}
        ${reservation.event_type || ""}
        ${reservation.event_subcategory || ""}
        ${reservation.supplier_ticket_id || ""}
        ${reservation.category || ""}
        ${reservation.block || ""}
        ${reservation.quantity || ""}
        ${reservation.status || ""}
        ${reservation.company_name || ""}
        ${reservation.contact_name || ""}
        ${reservation.email || ""}
      `.toLowerCase();

      const matchesSearch = text.includes(
        search.toLowerCase()
      );

      const matchesType = typeFilter
        ? reservation.event_type === typeFilter
        : true;

      const matchesSubcategory = subcategoryFilter
        ? reservation.event_subcategory === subcategoryFilter
        : true;

      return (
        matchesSearch &&
        matchesType &&
        matchesSubcategory
      );
    })
    .sort((a, b) => {
      const dateA = getEventTime(a.event_date);
      const dateB = getEventTime(b.event_date);

      if (sortDirection === "asc") {
        return dateA - dateB;
      }

      return dateB - dateA;
    });

  useEffect(() => {
    loadReservations();

    const interval = setInterval(() => {
      loadReservations();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="section">
      <h2>
        {isSuperAdmin
          ? "Reservations"
          : "Le mie reservations"}
      </h2>

      {error && <div className="error">{error}</div>}

      <div className="filters-bar">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setSubcategoryFilter("");
          }}
        >
          <option value="">Tutte le macro aree</option>

          {EVENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        <select
          value={subcategoryFilter}
          onChange={(e) =>
            setSubcategoryFilter(e.target.value)
          }
          disabled={!typeFilter}
        >
          <option value="">Tutte le sottocategorie</option>

          {availableSubcategories.map((subcategory) => (
            <option
              key={subcategory}
              value={subcategory}
            >
              {subcategory}
            </option>
          ))}
        </select>

        <select
          value={sortDirection}
          onChange={(e) =>
            setSortDirection(e.target.value)
          }
        >
          <option value="asc">
            Data evento: più vicina
          </option>

          <option value="desc">
            Data evento: più lontana
          </option>
        </select>

        <input
          type="text"
          placeholder="Cerca evento, ticket, categoria, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="tickets-table">
        <thead>
          <tr>
            <th>Codice</th>

            {isSuperAdmin && <th>User ID</th>}
            {isSuperAdmin && <th>Company</th>}
            {isSuperAdmin && <th>Email</th>}

            <th>Macro area</th>
            <th>Sottocategoria</th>
            <th>Evento</th>
            <th>Data evento</th>
            <th>Ticket</th>
            <th>Categoria</th>
            <th>Quantità</th>
            <th>Prezzo unitario</th>
            <th>Totale</th>
            <th>Stato</th>
            <th>Creata</th>
            <th>Confermata</th>
          </tr>
        </thead>

        <tbody>
          {filteredReservations.map((reservation) => (
            <tr key={reservation.reservation_code}>
              <td>{reservation.reservation_code}</td>

              {isSuperAdmin && (
                <td>{reservation.user_id || "-"}</td>
              )}

              {isSuperAdmin && (
                <td>
                  {reservation.company_name ||
                    "Storica / API key"}
                </td>
              )}

              {isSuperAdmin && (
                <td>{reservation.email || "-"}</td>
              )}

              <td>
                {getTypeLabel(
                  reservation.event_type
                )}
              </td>

              <td>
                {reservation.event_subcategory || "-"}
              </td>

              <td>{reservation.event_name || "-"}</td>

              <td>
                {formatDate(reservation.event_date)}
              </td>

              <td>
                {reservation.supplier_ticket_id}
              </td>

              <td>{reservation.category}</td>

              <td>{reservation.quantity}</td>

              <td>
                €
                {Number(
                  reservation.price || 0
                ).toFixed(2)}
              </td>

              <td>
                <strong>
                  € {getTotalPrice(reservation)}
                </strong>
              </td>

              <td>
                <span
                  className={`status-badge status-${reservation.status}`}
                >
                  {reservation.status}
                </span>
              </td>

              <td>
                {formatDate(reservation.created_at)}
              </td>

              <td>
                {formatDate(reservation.confirmed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReservationsTable;