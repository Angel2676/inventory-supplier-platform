const axios = require("axios");

const TICOMBO_BASE_URL =
  process.env.TICOMBO_BASE_URL || "https://external-api.devtic.net/v1";

const TICOMBO_API_TOKEN = process.env.TICOMBO_API_TOKEN;

function getHeaders() {
  return {
    "x-api-key": TICOMBO_API_TOKEN,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function createTicomboListing(payload) {
  const response = await axios.post(`${TICOMBO_BASE_URL}/listings`, payload, {
    headers: getHeaders(),
  });

  return response.data;
}

async function updateTicomboListing(listingId, payload) {
  const response = await axios.put(
    `${TICOMBO_BASE_URL}/listings/${listingId}`,
    payload,
    { headers: getHeaders() },
  );

  return response.data;
}

module.exports = {
  createTicomboListing,
  updateTicomboListing,
};
