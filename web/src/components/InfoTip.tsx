import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/** Click-to-toggle Parameter Guide note. */
export function InfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth * 0.72);
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    setPos({ top: r.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!text) return null;

  return (
    <div className="info-tip" ref={rootRef}>
      <button
        type="button"
        className={`info-tip-btn${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={`About ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="info" size={14} />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="info-tip-pop"
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
            >
              <strong>{label}</strong>
              <span>{text}</span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
