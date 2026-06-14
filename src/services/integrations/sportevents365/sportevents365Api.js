const axios = require("axios");

const SPORTSEVENTS365_BASE_URL =
  process.env.SPORTSEVENTS365_BASE_URL || "";

function getSportEvents365Config() {
  const username = process.env.SPORTSEVENTS365_HTTP_USERNAME;
  const password = process.env.SPORTSEVENTS365_HTTP_PASSWORD;
  const apiKey = process.env.SPORTSEVENTS365_API_KEY;
  const source = process.env.SPORTSEVENTS365_HTTP_SOURCE;

  const supplierEmail = process.env.SPORTSEVENTS365_SUPPLIER_EMAIL;
  const supplierPassword = process.env.SPORTSEVENTS365_SUPPLIER_PASSWORD;

  if (!SPORTSEVENTS365_BASE_URL) {
    throw new Error("SPORTSEVENTS365_BASE_URL mancante nel file .env");
  }

  if (!username || !password || !apiKey || !source) {
    throw new Error("Credenziali SportEvents365 mancanti nel file .env");
  }

  return {
    username,
    password,
    apiKey,
    source,
    supplierEmail,
    supplierPassword
  };
}

function getSportEvents365Client() {
  const { username, password, source } = getSportEvents365Config();

  const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

  return axios.create({
    baseURL: SPORTSEVENTS365_BASE_URL,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth}`,
      source
    }
  });
}

function getSportEvents365SupplierClient() {
  const { supplierEmail, supplierPassword, source } = getSportEvents365Config();

  if (!supplierEmail || !supplierPassword) {
    throw new Error(
      "Credenziali Supplier SportEvents365 mancanti: SPORTSEVENTS365_SUPPLIER_EMAIL / SPORTSEVENTS365_SUPPLIER_PASSWORD"
    );
  }

  const supplierAuth = Buffer.from(
    `${supplierEmail}:${supplierPassword}`
  ).toString("base64");

  return axios.create({
    baseURL: SPORTSEVENTS365_BASE_URL,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Supplier-Auth": supplierAuth,
      source
    }
  });
}

function getTodayDateForSportEvents365() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  return `${day}/${month}/${year}`;
}

function normalizeSportEvents365Event(event) {
  return {
    id: String(event.id),
    name: event.name,
    venue: event.venue?.name || "",
    city: event.city?.name || "",
    date: event.dateOfEvent || "",
    raw: event
  };
}

async function getSportEvents365EventTypes() {
  const client = getSportEvents365Client();
  const { apiKey } = getSportEvents365Config();

  const response = await client.get("/event-types", {
    params: {
      apiKey
    }
  });

  return response.data;
}

async function searchSportEvents365Events({ keyword }) {
  const client = getSportEvents365Client();
  const { apiKey } = getSportEvents365Config();

  const response = await client.get("/events/event-type/1000", {
    params: {
      apiKey,
      dateFrom: getTodayDateForSportEvents365(),
      perPage: 100,
      language: "en_us",
      currency: "EUR"
    }
  });

  const events = response.data?.data || [];

  const normalizedKeyword = String(keyword || "").toLowerCase();

  return events
    .filter((event) => {
      const text = [
        event.name,
        event.homeTeam?.name,
        event.awayTeam?.name,
        event.participants?.name,
        event.tournament?.name,
        event.city?.name,
        event.venue?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(normalizedKeyword);
    })
    .map(normalizeSportEvents365Event);
}

async function getSportEvents365TicketsByEventId(eventId) {
  const client = getSportEvents365Client();
  const { apiKey } = getSportEvents365Config();

  const response = await client.get(`/tickets/${eventId}`, {
    params: {
      apiKey,
      language: "en_us",
      currency: "EUR"
    }
  });

  return response.data;
}

async function getSupplierTicketOptions(eventId) {
  const client = getSportEvents365SupplierClient();
  const { apiKey } = getSportEvents365Config();

  const response = await client.get(`/supplier/event/${eventId}/ticket-options`, {
    params: {
      apiKey
    }
  });

  return response.data;
}

async function createSupplierTickets(eventId, tickets) {
  const client = getSportEvents365SupplierClient();
  const { apiKey } = getSportEvents365Config();

  const response = await client.post(
    `/supplier/event/${eventId}/tickets`,
    {
      tickets
    },
    {
      params: {
        apiKey
      }
    }
  );

  return response.data;
}

async function updateSupplierTicket(eventId, ticketId, payload) {
  const client = getSportEvents365SupplierClient();
  const { apiKey } = getSportEvents365Config();

  const response = await client.patch(
    `/supplier/event/${eventId}/ticket/${ticketId}`,
    payload,
    {
      params: {
        apiKey
      }
    }
  );

  return response.data;
}

module.exports = {
  getSportEvents365EventTypes,
  searchSportEvents365Events,
  getSportEvents365TicketsByEventId,
  getSupplierTicketOptions,
  createSupplierTickets,
  updateSupplierTicket
};