import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  it: {
    translation: {
      inventory: "Inventario disponibile",
      ticketsInventory: "Tickets Inventory",
      chooseTeam: "Seleziona team / artista / categoria",
      search: "Cerca",
      requestTickets: "Richiedi tickets",
      available: "Disponibili",
      eventDate: "Data evento",
      category: "Categoria",
      total: "Totale",
      selected: "Selezionato",
      noTickets: "Nessun ticket disponibile",
      filters: "Filtri",
      allTeams: "Tutti i team"
    }
  },

  en: {
    translation: {
      inventory: "Available inventory",
      ticketsInventory: "Tickets Inventory",
      chooseTeam: "Select team / artist / category",
      search: "Search",
      requestTickets: "Request tickets",
      available: "Available",
      eventDate: "Event date",
      category: "Category",
      total: "Total",
      selected: "Selected",
      noTickets: "No tickets available",
      filters: "Filters",
      allTeams: "All teams"
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",

  interpolation: {
    escapeValue: false
  }
});

export default i18n;