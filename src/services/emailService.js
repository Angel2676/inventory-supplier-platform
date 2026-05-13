async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (!process.env.RESEND_API_KEY) {
    console.log("Email non inviata: RESEND_API_KEY non configurata", {
      to,
      subject
    });
    return;
  }

  try {
    const payload = {
      from:
        process.env.EMAIL_FROM ||
        "Inventory Supplier <noreply@sportmaniatravel.net>",
      to,
      subject,
      text,
      html
    };

    if (attachments.length > 0) {
      payload.attachments = attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString("base64")
      }));
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Errore invio email Resend:", data);
      return;
    }

    console.log("Email inviata con Resend:", {
      to,
      subject,
      id: data.id
    });
  } catch (error) {
    console.error("Errore sendEmail Resend:", error);
  }
}

module.exports = sendEmail;