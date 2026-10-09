import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  foot,
  actions,
  className,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  foot?: ReactNode;
  /** Buttons shown next to Close. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className={`modal-sheet${wide ? " modal-sheet-wide" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="modal-head-actions">
            {actions}
            <button type="button" className="btn ghost modal-close" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {foot ? <div className="modal-foot">{foot}</div> : null}
      </div>
    </div>
  );
}
