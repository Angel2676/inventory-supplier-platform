require("dotenv").config();
const axios = require("axios");

const baseURL = process.env.SPORTSEVENTS365_BASE_URL;
const apiKey = String(process.env.SPORTSEVENTS365_API_KEY || "").trim();
const username = String(process.env.SPORTSEVENTS365_HTTP_USERNAME || "").trim();
const password = String(process.env.SPORTSEVENTS365_HTTP_PASSWORD || "").trim();
const source = String(process.env.SPORTSEVENTS365_HTTP_SOURCE || "").trim();

async function tryRequest(label, config) {
  try {
    const response = await axios.get(`${baseURL}/event-types`, config);
    console.log(`SUCCESS: ${label}`);
    console.log(response.data);
  } catch (error) {
    console.log(`FAILED: ${label}`);
    console.log("STATUS:", error.response?.status);
    console.log(error.response?.data || error.message);
  }
}

async function run() {
  await tryRequest("apiKey query only", {
    params: { apiKey },
  });

  await tryRequest("basic auth + apiKey query", {
    auth: { username, password },
    params: { apiKey },
  });

  await tryRequest("apiKey + source query", {
    params: { apiKey, source },
  });

  await tryRequest("apiKey + username/password/source query", {
    params: { apiKey, username, password, source },
  });

  await tryRequest("X-API-Key header only", {
    headers: { "X-API-Key": apiKey },
  });
}

run();
