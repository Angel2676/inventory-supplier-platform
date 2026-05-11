function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Utente non autenticato"
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: "Permessi insufficienti",
          current_role: req.user.role,
          allowed_roles: allowedRoles
        });
      }

      next();

    } catch (error) {
      console.error("Errore middleware requireRole:", error);

      return res.status(500).json({
        error: "Errore controllo permessi"
      });
    }
  };
}

module.exports = requireRole;