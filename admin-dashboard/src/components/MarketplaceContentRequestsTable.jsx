import { useEffect, useState } from "react";
import api from "../api";

function MarketplaceContentRequestsTable() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const response = await api.get("/api/marketplace-content-requests");

      setRequests(response.data.data || []);
    } catch (error) {
      console.error("Error loading marketplace content requests", error);
    }
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Marketplace</th>
            <th>Event</th>
            <th>Status</th>
            <th>Remote Event ID</th>
            <th>Notes</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>{request.marketplace}</td>
              <td>{request.event_name}</td>
              <td>{request.request_status}</td>
              <td>{request.remote_event_id}</td>
              <td>{request.notes}</td>
              <td>{new Date(request.created_at).toLocaleString()}</td>
            </tr>
          ))}

          {requests.length === 0 && (
            <tr>
              <td colSpan="6">No marketplace content requests</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default MarketplaceContentRequestsTable;
