function WhatsAppButton() {
  const phoneNumber = "393392986384";
  const message = encodeURIComponent(
    "Ciao, vorrei informazioni sulla piattaforma SportManiaTravel Inventory."
  );

  return (
    <a
      className="whatsapp-button"
      href={`https://wa.me/${phoneNumber}?text=${message}`}
      target="_blank"
      rel="noreferrer"
      title="Chatta con noi su WhatsApp"
    >
      WhatsApp
    </a>
  );
}

export default WhatsAppButton;