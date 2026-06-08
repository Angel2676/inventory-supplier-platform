import { useEffect, useState } from "react";
import api from "../api";

function TicomboCatalogUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);

  async function loadCatalog() {
    try {
      const response = await api.get("/api/marketplace/ticombo/catalog", {
        params: { q: query },
      });

      setStats(response.data.stats);
      setItems(response.data.items || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    loadCatalog();
  }

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
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      setResult(response.data);
      setFile(null);
      await loadCatalog();
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
    <div className="ticombo-catalog-card">
      <div className="ticombo-catalog-header">
        <div>
          <h3>Ticombo Event Catalog</h3>
          <p>
            Importa il catalogo ufficiale Ticombo per usare Event ID, slug,
            categorie e sezioni nel mapping e nel repricing.
          </p>
        </div>

        <div className="ticombo-catalog-badge">
          {stats?.total_records || 0} records
        </div>
      </div>

      <div className="ticombo-catalog-grid">
        <div className="ticombo-upload-box">
          <label>CSV Catalog File</label>

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

          {result && (
            <div className="ticombo-success">
              Catalogo importato: {result.imported} record.
            </div>
          )}

          {error && <div className="ticombo-error">{error}</div>}
        </div>

        <div className="ticombo-search-box">
          <form onSubmit={handleSearch}>
            <label>Search Catalog</label>

            <div className="ticombo-search-row">
              <input
                type="text"
                value={query}
                placeholder="Search event, slug, category..."
                onChange={(e) => setQuery(e.target.value)}
              />

              <button className="btn-secondary" type="submit">
                Search
              </button>
            </div>
          </form>

          <div className="ticombo-mini-stats">
            <span>Events: {stats?.unique_events || 0}</span>
            <span>Categories: {stats?.unique_categories || 0}</span>
          </div>
        </div>
      </div>

      <div className="ticombo-catalog-results">
        {items.map((item) => (
          <div className="ticombo-catalog-result" key={item.id}>
            <div>
              <strong>{item.event_name}</strong>
              <p>
                {item.category}
                {item.section ? ` · ${item.section}` : ""}
              </p>
            </div>

            <div className="ticombo-result-meta">
              <span>{item.remote_event_id}</span>
              <span>{item.slug}</span>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="ticombo-empty">Nessun record catalogo trovato.</p>
        )}
      </div>
    </div>
  );
}

export default TicomboCatalogUpload;
