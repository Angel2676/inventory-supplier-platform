async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (!process.env.RESEND_API_KEY) {
    console.log("Email non inviata: RESEND_API_KEY non configurata", {
      to,
      subject
    });
    return;
  }

  try {
    const normalizedAttachments = attachments.map((attachment) => {
      const isBuffer = Buffer.isBuffer(attachment.content);

      return {
        filename: attachment.filename,
        content: isBuffer
          ? attachment.content.toString("base64")
          : attachment.content,
        content_type: attachment.content_type || "application/pdf"
      };
    });

    console.log("Invio email Resend:", {
      to,
      subject,
      attachments: normalizedAttachments.map((a) => ({
        filename: a.filename,
        content_type: a.content_type,
        content_length: a.content?.length || 0
      }))
    });

    const payload = {
      from:
        process.env.EMAIL_FROM ||
        "Inventory Supplier <noreply@sportmaniatravel.net>",
      to,
      subject,
      text,
      html
    };

    if (normalizedAttachments.length > 0) {
      payload.attachments = normalizedAttachments;
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
      id: data.id,
      attachments_count: normalizedAttachments.length
    });
  } catch (error) {
    console.error("Errore sendEmail Resend:", error);
  }
}

module.exports = sendEmail;