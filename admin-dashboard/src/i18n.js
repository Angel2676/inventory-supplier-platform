import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  it: {
    translation: {
      inventory: "Inventario disponibile",
      ticketsInventory: "Tickets Inventory",
      chooseTeam: "Seleziona team / artista / categoria",

      yourNotifications: "Le tue notifiche",
      availableInventory: "Inventory disponibile",
      yourRequests: "Le tue richieste",
      yourReservations: "Le tue reservations",

      requestTickets: "Richiedi tickets",

      available: "Disponibili",
      total: "Totale"
    }
  },

  en: {
    translation: {
      inventory: "Available inventory",
      ticketsInventory: "Tickets Inventory",
      chooseTeam: "Select team / artist / category",

      yourNotifications: "Your notifications",
      availableInventory: "Available Inventory",
      yourRequests: "Your requests",
      yourReservations: "Your Reservations",

      requestTickets: "Request your tickets",

      available: "Available",
      total: "Total"
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