require("dotenv").config();

const axios = require("axios");
const {
  getAuthToken,
} = require("../src/services/integrations/gigsberg/gigsbergApi");

const GIGSBERG_BASE_URL =
  process.env.GIGSBERG_BASE_URL || "https://api.gigsberg.com/v1";

async function test() {
  try {
    const eventId = process.argv[2];

    if (!eventId) {
      throw new Error("Usage: node scripts/test-gigsberg-listings.js EVENT_ID");
    }

    const jwt = await getAuthToken();

    const urls = [
      `/event/${eventId}/listings`,
      `/event/${eventId}/tickets`,
      `/event/${eventId}/inventory`,
      `/listing/search?event_id=${eventId}`,
      `/listings?event_id=${eventId}`,
    ];

    for (const url of urls) {
      try {
        console.log("\nTesting POST /listing/search");

        const response = await axios.post(
          `${GIGSBERG_BASE_URL}/listing/search`,
          {
            event_id: eventId,
            page: 1,
            per_page: 20,
          },
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          },
        );

        console.log(JSON.stringify(response.data, null, 2));
      } catch (error) {
        console.log(
          "FAILED POST:",
          error.response?.status,
          error.response?.data || error.message,
        );
      }
      try {
        console.log(`\nTesting ${url}`);

        const response = await axios.get(`${GIGSBERG_BASE_URL}${url}`, {
          headers: {
            Authorization: `Bearer ${jwt}`,
            Accept: "application/json",
          },
        });

        console.log(JSON.stringify(response.data, null, 2));
      } catch (error) {
        console.log(
          "FAILED:",
          error.response?.status,
          error.response?.data || error.message,
        );
      }
    }
  } catch (error) {
    console.error(error.message);
  }
}

test();
