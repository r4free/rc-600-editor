import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Explanatory tooltip on hover/focus; the wrapper also catches hover on disabled buttons. */
export function HoverTip({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  children: ReactNode;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function show() {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth * 0.72);
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    setPos({ top: r.bottom + 6, left });
  }

  function hide() {
    setPos(null);
  }

  return (
    <span
      className="hover-tip"
      ref={rootRef}
      aria-describedby={pos ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos
        ? createPortal(
            <div
              id={id}
              className="info-tip-pop hover-tip-pop"
              role="tooltip"
              style={{ top: pos.top, left: pos.left }}
            >
              <strong>{label}</strong>
              <span>{text}</span>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
