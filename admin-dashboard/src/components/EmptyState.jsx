function EmptyState({
  title = "No results found",
  message = "Try changing filters or contact SportManiaTravel support.",
  showWhatsApp = true
}) {
  const whatsappText = encodeURIComponent(
    "Ciao, ho bisogno di supporto sulla piattaforma SportManiaTravel Inventory."
  );

  return (
    <div className="empty-state">
      <div className="empty-state-icon">SMT</div>

      <h3>{title}</h3>

      <p>{message}</p>

      {showWhatsApp && (
        <a
          className="empty-state-whatsapp"
          href={`https://wa.me/393392986384?text=${whatsappText}`}
          target="_blank"
          rel="noreferrer"
        >
          Chat WhatsApp
        </a>
      )}
    </div>
  );
}

export default EmptyState;