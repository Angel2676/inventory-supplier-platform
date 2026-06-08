import { useState } from "react";
import api from "../api";

function TicomboCatalogUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file) {
      setError("Seleziona un file CSV Ticombo");
      return;
    }

    try {
      setUploading(true);
      setError("");
      setResult(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post(
        "/api/marketplace/ticombo/catalog/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      setResult(response.data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Errore durante upload catalogo Ticombo",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="section">
      <h3>Ticombo Catalog</h3>

      <p>
        Carica il CSV catalogo Ticombo per importare Event ID, slug, categorie e
        sezioni utilizzabili per mapping e repricing.
      </p>

      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          className="btn-primary"
          type="button"
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload Ticombo Catalog"}
        </button>
      </div>

      {result && (
        <p style={{ marginTop: "12px", color: "green", fontWeight: 700 }}>
          Catalogo importato correttamente: {result.imported} record.
        </p>
      )}

      {error && (
        <p style={{ marginTop: "12px", color: "red", fontWeight: 700 }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default TicomboCatalogUpload;
