const axios = require("axios");

const TICOMBO_ENV = process.env.TICOMBO_ENV || "uat";

const TICOMBO_API_BASE_URL =
  TICOMBO_ENV === "production"
    ? process.env.TICOMBO_PROD_BASE_URL
    : process.env.TICOMBO_UAT_BASE_URL;

const TICOMBO_API_TOKEN =
  TICOMBO_ENV === "production"
    ? process.env.TICOMBO_PROD_API_TOKEN
    : process.env.TICOMBO_UAT_API_TOKEN;

function getTicomboClient() {
  if (!TICOMBO_API_BASE_URL || !TICOMBO_API_TOKEN) {
    throw new Error("Ticombo API base URL or token missing");
  }

  return axios.create({
    baseURL: TICOMBO_API_BASE_URL,
    headers: {
      "x-api-key": TICOMBO_API_TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: 20000,
  });
}

async function searchTicomboEvents(query) {
  const client = getTicomboClient();

  const response = await client.get("/events", {
    params: {
      name: query,
    },
  });

  return response.data;
}
async function getTicomboEventById(eventId) {
  const client = getTicomboClient();

  const response = await client.get(`/events/${eventId}`);

  return response.data;
}

module.exports = {
  searchTicomboEvents,
  getTicomboEventById,
};
