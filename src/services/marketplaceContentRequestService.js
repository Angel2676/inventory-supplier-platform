function isMarketplaceContentIssue(error) {
  const data = error?.response?.data || error?.message || error || {};
  const text = JSON.stringify(data).toLowerCase();

  return (
    text.includes("event not found") ||
    text.includes("invalid event") ||
    text.includes("eventid") ||
    text.includes("category not found") ||
    text.includes("mapping") ||
    text.includes("supplier not enabled") ||
    text.includes("publication unavailable")
  );
}

async function createMarketplaceContentRequest(
  db,
  {
    marketplace,
    listingId,
    eventName,
    eventDate,
    venueName,
    requestedAction,
    marketplaceError,
  },
) {
  const result = await db.query(
    `
    INSERT INTO marketplace_content_requests
      (marketplace, listing_id, event_name, event_date, venue_name, requested_action, marketplace_error)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      marketplace,
      listingId,
      eventName,
      eventDate,
      venueName,
      requestedAction,
      marketplaceError,
    ],
  );

  return result.rows[0];
}

module.exports = {
  isMarketplaceContentIssue,
  createMarketplaceContentRequest,
};
