const sendEmail = require("../services/emailService");
const express = require("express");

const router = express.Router();
const pool = require("../db");

const authJwt = require("../middleware/authJwt");
const requireRole = require("../middleware/requireRole");

/**
 * Lista utenti — solo super_admin
 */
router.get("/", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        company_name,
        contact_name,
        email,
        role,
        status,
        created_at,
        approved_at,
        approved_by
      FROM users
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Errore GET /api/users:", error);

    res.status(500).json({
      error: "Errore recupero utenti"
    });
  }
});

/**
 * Approva utente — solo super_admin
 */
router.patch("/:id/approve", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const userId = req.params.id;

    const result = await pool.query(
      `
      UPDATE users
      SET
        status = 'approved',
        approved_at = NOW(),
        approved_by = $1,
        email_verified = true,
        email_verification_token = null,
        email_verification_expires = null
      WHERE id = $2
      RETURNING
        id,
        company_name,
        contact_name,
        email,
        role,
        status,
        email_verified,
        created_at,
        approved_at,
        approved_by
      `,
      [req.user.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Utente non trovato"
      });
    }

    const approvedUser = result.rows[0];

    sendEmail({
      to: approvedUser.email,
      subject: "Account approvato - Inventory Supplier",
      text:
        "Il tuo account partner è stato approvato. Puoi ora accedere alla piattaforma Inventory Supplier.",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Account approvato</h2>

          <p>Gentile ${approvedUser.contact_name || approvedUser.company_name || "Partner"},</p>

          <p>
            il tuo account partner è stato approvato correttamente.
          </p>

          <p>
            Puoi ora accedere alla piattaforma Inventory Supplier utilizzando
            la tua email e la password indicata in fase di registrazione.
          </p>

          <p>
            Cordiali saluti<br/>
            Inventory Supplier Platform
          </p>
        </div>
      `
    }).catch((emailError) => {
      console.error("Errore invio email approvazione:", emailError);
    });

    res.json({
      message: "Utente approvato correttamente",
      user: approvedUser
    });
  } catch (error) {
    console.error("Errore approvazione utente:", error);

    res.status(500).json({
      error: "Errore approvazione utente"
    });
  }
});

/**
 * Rifiuta utente — solo super_admin
 */
router.patch("/:id/reject", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const userId = req.params.id;

    const result = await pool.query(
      `
      UPDATE users
      SET
        status = 'rejected'
      WHERE id = $1
      RETURNING
        id,
        company_name,
        contact_name,
        email,
        role,
        status
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Utente non trovato"
      });
    }

    res.json({
      message: "Utente rifiutato correttamente",
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Errore reject user:", error);

    res.status(500).json({
      error: "Errore rifiuto utente"
    });
  }
});
/**
 * Cambia ruolo utente — solo super_admin
 */
router.patch("/:id/role", authJwt, requireRole("super_admin"), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    const allowedRoles = [
      "super_admin",
      "partner",
      "inventory_manager",
      "sales_manager",
      "support_operator",
      "read_only_analyst",
      "finance"
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: "Ruolo non valido"
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET role = $1
      WHERE id = $2
      RETURNING
        id,
        company_name,
        contact_name,
        email,
        role,
        status,
        created_at,
        approved_at,
        approved_by
      `,
      [role, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Utente non trovato"
      });
    }

    res.json({
      message: "Ruolo aggiornato correttamente",
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Errore update user role:", error);

    res.status(500).json({
      error: "Errore aggiornamento ruolo utente"
    });
  }
});
module.exports = router;