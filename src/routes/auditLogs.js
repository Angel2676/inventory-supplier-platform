const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");
const express = require("express");
const router = express.Router();
const pool = require("../db");


/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Lista audit logs
 *     tags:
 *       - Audit Logs
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filtra per azione
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *         description: Filtra per tipo risorsa
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: integer
 *         description: Filtra per client ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Numero massimo risultati
 *     responses:
 *       200:
 *         description: Lista audit logs recuperata correttamente
 */
router.get("/", authJwt, requireRole("super_admin"), async (req, res) => {

  try {

    const {
      action,
      resource_type,
      client_id,
      limit
    } = req.query;

    let query = `
      SELECT
        audit_logs.id,
        audit_logs.action,
        audit_logs.resource_type,
        audit_logs.resource_id,
        audit_logs.metadata,
        audit_logs.created_at,
        api_clients.name AS client_name
      FROM audit_logs
      LEFT JOIN api_clients
        ON api_clients.id = audit_logs.client_id
      WHERE 1=1
    `;

    const values = [];
    let paramCount = 1;

    if (action) {
      query += ` AND audit_logs.action = $${paramCount}`;
      values.push(action);
      paramCount++;
    }

    if (resource_type) {
      query += ` AND audit_logs.resource_type = $${paramCount}`;
      values.push(resource_type);
      paramCount++;
    }

    if (client_id) {
      query += ` AND audit_logs.client_id = $${paramCount}`;
      values.push(client_id);
      paramCount++;
    }

    query += `
      ORDER BY audit_logs.id DESC
      LIMIT $${paramCount}
    `;

    values.push(Number(limit) || 100);

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (error) {

    console.error("Errore GET /api/audit-logs:", error);

    res.status(500).json({
      error: "Errore recupero audit logs"
    });
  }
});

module.exports = router;