import { useState } from "react";
import api from "../api";

function CsvUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleUpload(e) {
    e.preventDefault();

    if (!file) {
      setError("Seleziona un file CSV");
      return;
    }

    try {
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/api/tickets/bulk-upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setMessage(`Upload completato: ${response.data.imported_count} tickets importati`);
      setFile(null);

      if (onUploaded) {
        onUploaded();
      }
    } catch (err) {
      console.error(err);
      setError("Errore upload CSV");
    }
  }

  return (
    <div className="section form-card">
      <h2>Upload CSV tickets</h2>

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}

      <form onSubmit={handleUpload} className="csv-form">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button className="btn btn-save" type="submit">
          Carica CSV
        </button>
      </form>
    </div>
  );
}

export default CsvUpload;