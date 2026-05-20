const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const router = express.Router();

const pool = require("../db");
const sendEmail = require("../services/emailService");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5175";

/**
 * Registrazione partner/client
 */
router.post("/register", async (req, res) => {
  try {
    const {
      company_name,
      contact_name,
      email,
      password,
      phone,
      website,
      company_address,
      company_city,
      company_country,
      vat_number
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email e password sono obbligatorie"
      });
    }

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: "Email già registrata"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 1000 * 60 * 60 * 24);

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
        email_verification_expires,
        phone,
        website,
        company_address,
        company_city,
        company_country,
        vat_number
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'partner',
        'pending',
        false,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      )
      RETURNING
        id,
        company_name,
        contact_name,
        email,
        role,
        status,
        email_verified,
        phone,
        website,
        company_address,
        company_city,
        company_country,
        vat_number,
        created_at
      `,
      [
        company_name || null,
        contact_name || null,
        email,
        passwordHash,
        verificationToken,
        verificationExpires,
        phone || null,
        website || null,
        company_address || null,
        company_city || null,
        company_country || null,
        vat_number || null
      ]
    );

    sendEmail({
      to: email,
      subject: "Registrazione ricevuta - Inventory Supplier",
      text:
        "Grazie per la registrazione. Il tuo account partner è stato ricevuto correttamente. A breve il nostro team verificherà la richiesta e potrai accedere ai nostri servizi.",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Registrazione ricevuta</h2>
          <p>Gentile ${contact_name || company_name || "Partner"},</p>
          <p>grazie per la registrazione alla piattaforma Inventory Supplier.</p>
          <p>Il tuo account partner è stato ricevuto correttamente.</p>
          <p>A breve il nostro team verificherà la richiesta e potrai accedere ai nostri servizi.</p>
          <p>Cordiali saluti<br/>Inventory Supplier Platform</p>
        </div>
      `
    }).catch((emailError) => {
      console.error("Errore invio email registrazione:", emailError);
    });

    res.status(201).json({
      message:
        "Grazie per la registrazione. Il tuo account è stato creato correttamente e sarà verificato dal nostro team. A breve potrai accedere ai nostri servizi.",
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Errore register:", error);

    res.status(500).json({
      error: "Errore registrazione utente"
    });
  }
});

/**
 * Verifica email tramite token
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
 * Login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email e password sono obbligatorie"
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

/**
 * Forgot password
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email obbligatoria"
      });
    }

    const userResult = await pool.query(
      `
      SELECT id, email, company_name, contact_name
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    /*
     * Risposta neutra per sicurezza:
     * non riveliamo se l'email esiste o meno.
     */
    if (userResult.rows.length === 0) {
      return res.json({
        message:
          "Se l'email è registrata, riceverai un link per reimpostare la password."
      });
    }

    const user = userResult.rows[0];

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 1000 * 60 * 60);

    await pool.query(
      `
      UPDATE users
      SET
        password_reset_token = $1,
        password_reset_expires = $2
      WHERE id = $3
      `,
      [resetToken, resetExpires, user.id]
    );

    const resetLink = `${FRONTEND_URL}/reset-password/${resetToken}`;

    sendEmail({
      to: user.email,
      subject: "Reset password - Inventory Supplier",
      text: `Puoi reimpostare la password cliccando questo link: ${resetLink}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Reset password</h2>

          <p>Gentile ${user.contact_name || user.company_name || "utente"},</p>

          <p>
            abbiamo ricevuto una richiesta di reimpostazione password
            per il tuo account Inventory Supplier.
          </p>

          <p>
            Clicca sul link seguente per impostare una nuova password:
          </p>

          <p>
            <a href="${resetLink}">${resetLink}</a>
          </p>

          <p>
            Il link è valido per 1 ora. Se non hai richiesto tu questa operazione,
            puoi ignorare questa email.
          </p>

          <p>
            Cordiali saluti<br/>
            Inventory Supplier Platform
          </p>
        </div>
      `
    }).catch((emailError) => {
      console.error("Errore invio email reset password:", emailError);
    });

    res.json({
      message:
        "Se l'email è registrata, riceverai un link per reimpostare la password."
    });
  } catch (error) {
    console.error("Errore forgot-password:", error);

    res.status(500).json({
      error: "Errore richiesta reset password"
    });
  }
});

/**
 * Reset password
 */
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: "Nuova password obbligatoria"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "La password deve contenere almeno 8 caratteri"
      });
    }

    const userResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE password_reset_token = $1
      AND password_reset_expires > NOW()
      `,
      [token]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: "Token reset password non valido o scaduto"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        password_reset_token = null,
        password_reset_expires = null
      WHERE id = $2
      `,
      [passwordHash, userResult.rows[0].id]
    );

    res.json({
      message:
        "Password aggiornata correttamente. Ora puoi effettuare il login."
    });
  } catch (error) {
    console.error("Errore reset-password:", error);

    res.status(500).json({
      error: "Errore reset password"
    });
  }
});

module.exports = router;