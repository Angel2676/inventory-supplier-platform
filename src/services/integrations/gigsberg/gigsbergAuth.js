const axios = require("axios");

async function authenticateGigsberg() {
  try {
    const response = await axios.post(
      "https://api.gigsberg.com/v1/auth",
      {
        apiKey: process.env.GIGSBERG_API_KEY,
        userId: Number(process.env.GIGSBERG_USER_ID)
      }
    );

    return {
      jwt: response.data.jwt,
      refreshToken: response.data.refreshToken
    };
  } catch (error) {
    console.error(
      "Errore autenticazione Gigsberg:",
      error.response?.data || error.message
    );

    throw error;
  }
}

module.exports = {
  authenticateGigsberg
};