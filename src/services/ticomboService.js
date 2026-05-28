const axios = require("axios");

const TICOMBO_API_BASE_URL = process.env.TICOMBO_API_BASE_URL;
const TICOMBO_API_TOKEN = process.env.TICOMBO_API_TOKEN;

function getTicomboClient() {
  if (!TICOMBO_API_BASE_URL || !TICOMBO_API_TOKEN) {
    throw new Error("Ticombo API base URL or token missing");
  }

  return axios.create({
    baseURL: TICOMBO_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${TICOMBO_API_TOKEN}`,
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

module.exports = {
  searchTicomboEvents,
};
