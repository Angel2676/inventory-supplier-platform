const { getTicomboClient } = require("./ticomboApi");

async function createTicomboListing(payload) {
  const client = getTicomboClient();

  const response = await client.post("/listings", payload);

  return response.data;
}

async function getTicomboListing(listingId) {
  const client = getTicomboClient();

  const response = await client.get(`/listings/${listingId}`);

  return response.data;
}

async function updateTicomboListing(listingId, updates) {
  const client = getTicomboClient();

  const currentResponse = await getTicomboListing(listingId);
  const current = currentResponse.data || currentResponse;

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
    faceValue: Number(
      current.faceValue?.amount || current.faceValue || price || 0,
    ),
    allowProposals: current.allowProposals || false,
    refId: current.refId,

    sellingOptions: {
      splitType: current.sellingOptions?.splitType || "none",
      maxDisplayQuantity: quantity,
      customQuantities: current.sellingOptions?.customQuantities || [],
    },
  };

  const response = await client.put(`/listings/${listingId}`, payload);

  return response.data;
}

async function deleteTicomboListing(listingId) {
  const client = getTicomboClient();

  const response = await client.delete(`/listings/${listingId}`);

  return response.data;
}

module.exports = {
  createTicomboListing,
  getTicomboListing,
  updateTicomboListing,
  deleteTicomboListing,
};
