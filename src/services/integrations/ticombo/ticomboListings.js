const axios = require("axios");

const TICOMBO_BASE_URL =
  process.env.TICOMBO_BASE_URL || "https://external-api.devtic.net/v1";

const TICOMBO_API_TOKEN = process.env.TICOMBO_API_TOKEN;

async function createTicomboListing(payload) {
  try {
    const response = await axios.post(`${TICOMBO_BASE_URL}/listings`, payload, {
      headers: {
        Authorization: `Bearer ${TICOMBO_API_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      "Errore createTicomboListing:",
      error.response?.data || error.message,
    );

    throw error;
  }
}

module.exports = {
  createTicomboListing,
};
