import { useEffect, useState } from "react";
import api from "../api";

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      const response = await api.get("/api/notifications");
      setNotifications(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Errore caricamento notifiche");
    }
  }

  async function markAsRead(notificationId) {
    try {
      await api.patch(`/api/notifications/${notificationId}/read`);
      await loadNotifications();
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="section form-card">
      <h2>Notification Center</h2>

      <p>Notifiche non lette: <strong>{unreadCount}</strong></p>

      {error && <div className="error">{error}</div>}

      {notifications.length === 0 && (
        <p>Nessuna notifica disponibile.</p>
      )}

      <div className="notifications-list">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification-item ${
              notification.is_read ? "read" : "unread"
            }`}
          >
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.message}</p>
              <small>
                {new Date(notification.created_at).toLocaleString()}
              </small>
            </div>

            {!notification.is_read && (
              <button
                className="btn btn-secondary"
                onClick={() => markAsRead(notification.id)}
              >
                Segna come letta
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationCenter;