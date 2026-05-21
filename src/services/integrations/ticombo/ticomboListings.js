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

async function getTicomboListing(listingId) {
  const response = await axios.get(
    `${TICOMBO_BASE_URL}/listings/${listingId}`,
    {
      headers: getHeaders(),
    },
  );

  return response.data;
}

async function updateTicomboListing(listingId, updates) {
  const currentResponse = await getTicomboListing(listingId);
  const current = currentResponse.data;

  const quantity =
    updates.quantity !== undefined
      ? Number(updates.quantity)
      : Number(current.quantity);

  const price =
    updates.price !== undefined ? Number(updates.price) : Number(current.price);

  const payload = {
    type: current.type,
    section: current.section || "",
    row: current.row || "",
    quantity,
    isInPossession: current.isInPossession,
    listWithoutTicketUpload: current.listWithoutTicketUpload,

    seats: Array.from({ length: quantity }, () => ({
      seat: "",
      file: "",
    })),

    delivery: {
      inHandDate: current.delivery?.inHandDate,
    },

    price,
    currency: current.currency || "EUR",
    faceValue: Number(current.faceValue?.amount || price || 0),
    allowProposals: current.allowProposals || false,
    refId: current.refId,

    sellingOptions: {
      splitType: current.sellingOptions?.splitType || "none",
      maxDisplayQuantity: quantity,
      customQuantities: current.sellingOptions?.customQuantities || [],
    },
  };

  const response = await axios.put(
    `${TICOMBO_BASE_URL}/listings/${listingId}`,
    payload,
    { headers: getHeaders() },
  );

  return response.data;
}
async function deleteTicomboListing(listingId) {
  const response = await axios.delete(
    `${TICOMBO_BASE_URL}/listings/${listingId}`,

    {
      headers: getHeaders(),
    },
  );

  return response.data;
}

module.exports = {
  createTicomboListing,

  getTicomboListing,

  updateTicomboListing,

  deleteTicomboListing,
};
