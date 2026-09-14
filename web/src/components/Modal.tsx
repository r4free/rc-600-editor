import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  foot,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  foot?: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal-sheet${wide ? " modal-sheet-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn ghost modal-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot ? <div className="modal-foot">{foot}</div> : null}
      </div>
    </div>
  );
}
