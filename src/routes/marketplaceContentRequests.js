const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM marketplace_content_requests
      ORDER BY updated_at DESC, id DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error loading marketplace content requests:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/:id/resolve-mapping", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      internal_category,
      remote_event_id,
      remote_event_name,
      remote_category_name,
      notes,
    } = req.body;

    await client.query("BEGIN");

    const requestResult = await client.query(
      `
      SELECT *
      FROM marketplace_content_requests
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        error: "Content request non trovata",
      });
    }

    const request = requestResult.rows[0];

    if (!request.marketplace || !request.event_id) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        error: "Content request incompleta: marketplace o event_id mancanti",
      });
    }

    if (!remote_event_id) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        error: "remote_event_id obbligatorio",
      });
    }

    if (!internal_category || !remote_category_name) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        error: "internal_category e remote_category_name sono obbligatori",
      });
    }

    const existingEventMapping = await client.query(
      `
      SELECT *
      FROM marketplace_mappings
      WHERE marketplace = $1
        AND mapping_type = 'event'
        AND internal_event_id = $2
        AND is_active = true
      LIMIT 1
      `,
      [request.marketplace, request.event_id],
    );

    let eventMapping;

    if (existingEventMapping.rows.length > 0) {
      const updateEventResult = await client.query(
        `
        UPDATE marketplace_mappings
        SET
          remote_event_id = $1,
          remote_event_name = $2,
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [
          remote_event_id,
          remote_event_name || request.event_name || null,
          existingEventMapping.rows[0].id,
        ],
      );

      eventMapping = updateEventResult.rows[0];
    } else {
      const insertEventResult = await client.query(
        `
        INSERT INTO marketplace_mappings (
          marketplace,
          mapping_type,
          internal_event_id,
          remote_event_id,
          remote_event_name,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1,'event',$2,$3,$4,true,NOW(),NOW())
        RETURNING *
        `,
        [
          request.marketplace,
          request.event_id,
          remote_event_id,
          remote_event_name || request.event_name || null,
        ],
      );

      eventMapping = insertEventResult.rows[0];
    }

    const existingCategoryMapping = await client.query(
      `
      SELECT *
      FROM marketplace_mappings
      WHERE marketplace = $1
        AND mapping_type = 'category'
        AND internal_event_id = $2
        AND internal_category = $3
        AND is_active = true
      LIMIT 1
      `,
      [request.marketplace, request.event_id, internal_category],
    );

    let categoryMapping;

    if (existingCategoryMapping.rows.length > 0) {
      const updateCategoryResult = await client.query(
        `
        UPDATE marketplace_mappings
        SET
          remote_event_id = $1,
          remote_event_name = $2,
          remote_category_name = $3,
          notes = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
        `,
        [
          remote_event_id,
          remote_event_name || request.event_name || null,
          remote_category_name,
          notes || null,
          existingCategoryMapping.rows[0].id,
        ],
      );

      categoryMapping = updateCategoryResult.rows[0];
    } else {
      const insertCategoryResult = await client.query(
        `
        INSERT INTO marketplace_mappings (
          marketplace,
          mapping_type,
          internal_event_id,
          internal_category,
          remote_event_id,
          remote_event_name,
          remote_category_name,
          notes,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1,'category',$2,$3,$4,$5,$6,$7,true,NOW(),NOW())
        RETURNING *
        `,
        [
          request.marketplace,
          request.event_id,
          internal_category,
          remote_event_id,
          remote_event_name || request.event_name || null,
          remote_category_name,
          notes || null,
        ],
      );

      categoryMapping = insertCategoryResult.rows[0];
    }

    const resolvedResult = await client.query(
      `
      UPDATE marketplace_content_requests
      SET
        request_status = 'resolved',
        remote_event_id = $1,
        notes = COALESCE($2, notes),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [remote_event_id, notes || null, id],
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Mapping risolto correttamente",
      request: resolvedResult.rows[0],
      eventMapping,
      categoryMapping,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error resolving marketplace content request:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
