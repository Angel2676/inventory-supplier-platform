import { useState } from "react";

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="collapsible-section">
      <button
        className="collapsible-header"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <span className={`chevron ${open ? "open" : ""}`}>
          ▼
        </span>
      </button>

      {open && (
        <div className="collapsible-body">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;