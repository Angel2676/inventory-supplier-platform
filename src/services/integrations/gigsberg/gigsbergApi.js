const axios = require("axios");
const { authenticateGigsberg } = require("./gigsbergAuth");

const GIGSBERG_BASE_URL =
  process.env.GIGSBERG_BASE_URL || "https://api.gigsberg.com/v1";

let cachedJwt = null;
let cachedRefreshToken = null;
let lastAuthAt = null;

async function getAuthToken() {
  const now = Date.now();

  const tokenStillValid =
    cachedJwt && lastAuthAt && now - lastAuthAt < 45 * 60 * 1000;

  if (tokenStillValid) {
    return cachedJwt;
  }

  const auth = await authenticateGigsberg();

  cachedJwt = auth.jwt;
  cachedRefreshToken = auth.refreshToken;
  lastAuthAt = now;

  return cachedJwt;
}

async function gigsbergRequest({ method, url, data, params }) {
  const jwt = await getAuthToken();

  try {
    const response = await axios({
      method,
      url: `${GIGSBERG_BASE_URL}${url}`,
      data,
      params,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Errore richiesta Gigsberg:", {
      method,
      url,
      status: error.response?.status,
      data: error.response?.data || error.message,
    });

    throw error;
  }
}

async function getCurrentUser() {
  return gigsbergRequest({
    method: "GET",
    url: "/user",
  });
}

async function searchEvents({
  keyword,
  name,
  city,
  venue,
  performer1,
  performer2,
  future_events_only = true,
  page = 1,
  per_page = 30,
} = {}) {
  return gigsbergRequest({
    method: "POST",
    url: "/event/search",
    data: {
      page,
      per_page,
      keyword,
      name,
      city,
      venue,
      performer1,
      performer2,
      future_events_only,
    },
  });
}

async function getEventCategories(eventId) {
  if (!eventId) {
    throw new Error("eventId obbligatorio per getEventCategories");
  }

  return gigsbergRequest({
    method: "GET",
    url: `/event/${eventId}/categories`,
  });
}
async function deleteListing(listingId) {
  if (!listingId) {
    throw new Error("listingId obbligatorio");
  }

  return gigsbergRequest({
    method: "DELETE",
    url: `/listing/${listingId}`,
  });
}
async function updateListing(listingId, payload) {
  if (!listingId) {
    throw new Error("listingId obbligatorio");
  }

  return gigsbergRequest({
    method: "PUT",
    url: `/listing/${listingId}`,
    data: payload,
  });
}

module.exports = {
  getAuthToken,
  getCurrentUser,
  searchEvents,
  getEventCategories,
  deleteListing,
  updateListing,
};
