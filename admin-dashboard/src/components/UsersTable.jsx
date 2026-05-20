import { useEffect, useState } from "react";
import api from "../api";

function UsersTable() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      const response = await api.get("/api/users");

      setUsers(response.data);
    } catch (err) {
      console.error(err);

      setError("Errore caricamento utenti");
    }
  }

  async function approveUser(userId) {
    try {
      await api.patch(`/api/users/${userId}/approve`);

      loadUsers();
    } catch (err) {
      console.error(err);
    }
  }

  async function rejectUser(userId) {
    try {
      await api.patch(`/api/users/${userId}/reject`);

      loadUsers();
    } catch (err) {
      console.error(err);
    }
  }

  async function updateUserRole(userId, role) {
    try {
      await api.patch(`/api/users/${userId}/role`, {
        role
      });

      loadUsers();
    } catch (err) {
      console.error(err);

      setError("Errore aggiornamento ruolo utente");
    }
  }

  useEffect(() => {
    loadUsers();

    const interval = setInterval(() => {
      loadUsers();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="section">
      <h2>Users Management</h2>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <div className="table-wrapper">
        <table className="tickets-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Website</th>
              <th>City</th>
              <th>Country</th>
              <th>VAT</th>
              <th>Role</th>
              <th>Status</th>
              <th>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>

                <td>{user.company_name || "-"}</td>

                <td>{user.contact_name || "-"}</td>

                <td>{user.email}</td>

                <td>{user.phone || "-"}</td>

                <td>
                  {user.website ? (
                    <a
                      href={
                        user.website.startsWith("http")
                          ? user.website
                          : `https://${user.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {user.website}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>

                <td>{user.company_city || "-"}</td>

                <td>{user.company_country || "-"}</td>

                <td>{user.vat_number || "-"}</td>

                <td>
                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateUserRole(
                        user.id,
                        e.target.value
                      )
                    }
                  >
                    <option value="partner">
                      partner
                    </option>

                    <option value="inventory_manager">
                      inventory_manager
                    </option>

                    <option value="sales_manager">
                      sales_manager
                    </option>

                    <option value="support_operator">
                      support_operator
                    </option>

                    <option value="read_only_analyst">
                      read_only_analyst
                    </option>

                    <option value="finance">
                      finance
                    </option>

                    <option value="super_admin">
                      super_admin
                    </option>
                  </select>
                </td>

                <td>
                  <span
                    className={`status-badge status-${user.status}`}
                  >
                    {user.status}
                  </span>
                </td>

                <td>
                  {user.status === "pending" && (
                    <>
                      <button
                        className="btn btn-save"
                        onClick={() =>
                          approveUser(user.id)
                        }
                      >
                        Approva
                      </button>

                      <button
                        className="btn btn-delete"
                        onClick={() =>
                          rejectUser(user.id)
                        }
                      >
                        Rifiuta
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UsersTable;