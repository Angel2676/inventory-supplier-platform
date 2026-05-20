const axios = require("axios");

const TICOMBO_BASE_URL =
  process.env.TICOMBO_BASE_URL || "https://external-api.devtic.net/v1";

function getTicomboHeaders() {
  const token = process.env.TICOMBO_API_TOKEN;

  if (!token) {
    throw new Error("TICOMBO_API_TOKEN mancante nel file .env");
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": token,
  };
}

async function updateTicomboListing(listingId, payload) {
  if (!listingId) {
    throw new Error("Ticombo listingId mancante");
  }

  const response = await axios.put(
    `${TICOMBO_BASE_URL}/listings/${listingId}`,
    payload,
    {
      headers: getTicomboHeaders(),
    },
  );

  return response.data;
}

module.exports = {
  updateTicomboListing,
};
