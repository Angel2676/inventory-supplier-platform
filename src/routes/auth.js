const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const router = express.Router();
const pool = require("../db");
const sendEmail = require("../services/emailService");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:3000";

/**
 * Registrazione partner/client.
 * L'utente nasce pending e deve verificare l'email.
 */
router.post("/register", async (req, res) => {
  try {
    const { company_name, contact_name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "email e password sono obbligatorie"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const result = await pool.query(
      `
      INSERT INTO users (
        company_name,
        contact_name,
        email,
        password_hash,
        role,
        status,
        email_verified,
        email_verification_token,
        email_verification_expires
      )
      VALUES (
        $1, $2, $3, $4,
        'partner',
        'pending',
        false,
        $5,
        NOW() + interval '24 hours'
      )
      RETURNING
        id,
        company_name,
        contact_name,
        email,
        role,
        status,
        email_verified,
        created_at
      `,
      [
        company_name || null,
        contact_name || null,
        email,
        passwordHash,
        verificationToken
      ]
    );

    const verifyLink = `${BACKEND_URL}/api/auth/verify-email/${verificationToken}`;

    await sendEmail({
      to: email,
      subject: "Verifica il tuo account Inventory Supplier",
      text: `Clicca questo link per verificare il tuo account: ${verifyLink}`,
      html: `
        <p>Gentile ${contact_name || company_name || "Partner"},</p>
        <p>grazie per la registrazione.</p>
        <p>Per verificare il tuo account clicca sul link seguente:</p>
        <p><a href="${verifyLink}">${verifyLink}</a></p>
        <p>Il link è valido per 24 ore.</p>
      `
    });

    res.status(201).json({
      message:
        "Registrazione ricevuta. Controlla la tua email per verificare l'account. Dopo la verifica, il super admin dovrà approvarlo.",
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Errore register:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Email già registrata"
      });
    }

    res.status(500).json({
      error: "Errore registrazione utente"
    });
  }
});

/**
 * Verifica email.
 */
router.get("/verify-email/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const result = await pool.query(
      `
      UPDATE users
      SET
        email_verified = true,
        email_verification_token = null,
        email_verification_expires = null
      WHERE email_verification_token = $1
      AND email_verification_expires > NOW()
      RETURNING id, email, status, email_verified
      `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).send(`
        <h2>Link non valido o scaduto</h2>
        <p>Richiedi una nuova registrazione o contatta l'amministratore.</p>
      `);
    }

    res.send(`
      <h2>Email verificata correttamente</h2>
      <p>Il tuo account è ora verificato. Attendi l'approvazione del super admin.</p>
    `);
  } catch (error) {
    console.error("Errore verify email:", error);

    res.status(500).send(`
      <h2>Errore verifica email</h2>
      <p>Si è verificato un errore durante la verifica.</p>
    `);
  }
});

/**
 * Login.
 * Solo utenti verified + approved possono accedere.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "email e password sono obbligatorie"
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Credenziali non valide"
      });
    }

    const user = result.rows[0];

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        error: "Credenziali non valide"
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        error: "Email non ancora verificata"
      });
    }

    if (user.status !== "approved") {
      return res.status(403).json({
        error: "Account non ancora approvato"
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status
      },
      JWT_SECRET,
      {
        expiresIn: "8h"
      }
    );

    res.json({
      message: "Login effettuato correttamente",
      token,
      user: {
        id: user.id,
        company_name: user.company_name,
        contact_name: user.contact_name,
        email: user.email,
        role: user.role,
        status: user.status,
        email_verified: user.email_verified
      }
    });
  } catch (error) {
    console.error("Errore login:", error);

    res.status(500).json({
      error: "Errore login"
    });
  }
});

module.exports = router;