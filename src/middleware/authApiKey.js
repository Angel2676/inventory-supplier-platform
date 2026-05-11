const pool = require("../db");

async function authApiKey(req, res, next) {

  try {

    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({
        error: "API key mancante"
      });
    }

    const result = await pool.query(
      `
      SELECT id, name, active
      FROM api_clients
      WHERE api_key = $1
      `,
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "API key non valida"
      });
    }

    const client = result.rows[0];

    if (!client.active) {
      return res.status(403).json({
        error: "Cliente API disabilitato"
      });
    }

    req.apiClient = client;

    next();

  } catch (error) {

    console.error("Errore auth API key:", error);

    res.status(500).json({
      error: "Errore autenticazione API"
    });
  }
}

module.exports = authApiKey;