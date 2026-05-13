.success-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: rgba(2, 6, 23, 0.68);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.success-modal {
  width: min(460px, 94vw);
  background: #ffffff;
  border-radius: 30px;
  padding: 38px 32px;
  text-align: center;
  box-shadow: 0 40px 100px rgba(2, 6, 23, 0.4);
  animation: modalPop 0.22s ease both;
}

.success-modal-icon {
  width: 74px;
  height: 74px;
  margin: 0 auto 18px;
  border-radius: 24px;
  background: linear-gradient(135deg, #22c55e, #2563eb);
  color: #ffffff;
  font-size: 42px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16px 34px rgba(34, 197, 94, 0.28);
}

.success-modal h2 {
  color: #0f172a;
  font-size: 26px;
  margin-bottom: 10px;
}

.success-modal p {
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 24px;
}