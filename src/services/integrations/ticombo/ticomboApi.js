const axios = require("axios");

const TICOMBO_BASE_URL =
  process.env.TICOMBO_BASE_URL || "https://uat.ticombo.com";

function getTicomboConfig() {
  const token = process.env.TICOMBO_API_TOKEN;

  if (!token) {
    throw new Error("TICOMBO_API_TOKEN mancante nel file .env");
  }

  return { token };
}

function getTicomboClient() {
  const { token } = getTicomboConfig();

  return axios.create({
    baseURL: TICOMBO_BASE_URL,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": token,
    },
  });
}

async function testTicomboConnection(path = "/api") {
  const client = getTicomboClient();

  const response = await client.get(path);

  return response.data;
}

module.exports = {
  getTicomboClient,
  testTicomboConnection,
};
