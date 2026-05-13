function SuccessModal({
  title = "Operazione completata",
  message,
  onClose
}) {
  return (
    <div className="success-modal-overlay">
      <div className="success-modal">
        <div className="success-modal-icon">✓</div>

        <h2>{title}</h2>

        <p>{message}</p>

        <button
          className="btn btn-save"
          type="button"
          onClick={onClose}
        >
          Continua
        </button>
      </div>
    </div>
  );
}

export default SuccessModal;