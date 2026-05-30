const axios = require("axios");

function getTicomboConfig() {
  const env = (process.env.TICOMBO_ENV || "uat").toLowerCase();

  if (env === "prod") {
    const token = process.env.TICOMBO_PROD_API_TOKEN;

    if (!token) {
      throw new Error("TICOMBO_PROD_API_TOKEN mancante");
    }

    return {
      environment: "prod",
      baseURL: process.env.TICOMBO_PROD_BASE_URL,
      token,
    };
  }

  const token = process.env.TICOMBO_UAT_API_TOKEN;

  if (!token) {
    throw new Error("TICOMBO_UAT_API_TOKEN mancante");
  }

  return {
    environment: "uat",
    baseURL: process.env.TICOMBO_UAT_BASE_URL,
    token,
  };
}

function getTicomboClient() {
  const config = getTicomboConfig();

  return axios.create({
    baseURL: config.baseURL,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": config.token,
    },
  });
}

async function testTicomboConnection(path = "/events") {
  const client = getTicomboClient();

  const response = await client.get(path, {
    params: {
      page: 1,
      limit: 5,
    },
  });

  return response.data;
}

module.exports = {
  getTicomboClient,
  getTicomboConfig,
  testTicomboConnection,
};
