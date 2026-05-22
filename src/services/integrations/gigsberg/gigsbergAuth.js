const axios = require("axios");

const GIGSBERG_BASE_URL =
  process.env.GIGSBERG_BASE_URL || "https://api.gigsberg.com/v1";

async function authenticateGigsberg() {
  const apiKey = process.env.GIGSBERG_API_KEY;
  const userId = process.env.GIGSBERG_USER_ID;

  if (!apiKey) {
    throw new Error("GIGSBERG_API_KEY mancante nel file .env");
  }

  if (!userId) {
    throw new Error("GIGSBERG_USER_ID mancante nel file .env");
  }

  const response = await axios.post(
    `${GIGSBERG_BASE_URL}/auth`,
    {
      apiKey,
      userId,
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

module.exports = {
  authenticateGigsberg,
};
