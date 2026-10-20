import {
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Icon } from "./Icon";

export function MemoryApplyTargetsModal({
  memories,
  sourceSlot,
  summary,
  onCancel,
  onConfirm,
}: {
  memories: { slot: number; name: string }[];
  sourceSlot: number;
  summary: string;
  onCancel: () => void;
  onConfirm: (targets: number[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const anchorRef = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const selectable = memories.filter((m) => m.slot !== sourceSlot).map((m) => m.slot);

  function applySlots(slots: number[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const slot of slots) {
        if (slot === sourceSlot) continue;
        if (on) next.add(slot);
        else next.delete(slot);
      }
      return next;
    });
  }

  function rangeBetween(a: number, b: number): number[] {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return selectable.filter((s) => s >= lo && s <= hi);
  }

  function slotAtPoint(clientX: number, clientY: number): number | null {
    const el = document.elementFromPoint(clientX, clientY);
    const card = el?.closest<HTMLElement>("[data-mem-slot]");
    if (!card || card.dataset.memDisabled === "1") return null;
    const slot = Number(card.dataset.memSlot);
    return Number.isFinite(slot) ? slot : null;
  }

  function onCardPointerDown(e: ReactPointerEvent, slot: number) {
    if (e.button !== 0 || slot === sourceSlot) return;
    e.preventDefault();

    if (e.shiftKey && anchorRef.current != null) {
      applySlots(rangeBetween(anchorRef.current, slot), true);
      suppressClick.current = true;
      return;
    }

    const paintOn = !selected.has(slot);
    const visited = new Set<number>();
    const paint = (s: number) => {
      if (visited.has(s) || s === sourceSlot) return;
      visited.add(s);
      applySlots([s], paintOn);
    };

    const move = (ev: PointerEvent) => {
      const s = slotAtPoint(ev.clientX, ev.clientY);
      if (s != null) paint(s);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      anchorRef.current = slot;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };

    suppressClick.current = true;
    paint(slot);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-sheet mem-apply-targets-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mem-apply-targets-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mem-apply-targets-head">
          <h2 id="mem-apply-targets-title">Mass Apply</h2>
          <p className="hint">
            Apply clipboard ({summary}) from memory {String(sourceSlot).padStart(2, "0")} to the
            selected memories. Click a card to toggle, drag across cards to paint, or hold Shift and
            click to select a range.
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setSelected(new Set(selectable))}
            >
              Select all
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={selected.size === 0}
              onClick={() => setSelected(new Set())}
            >
              Deselect all
            </button>
          </div>
        </div>
        <div
          className="mem-apply-targets track-state-cards"
          onClickCapture={(e: ReactMouseEvent) => {
            if (!suppressClick.current) return;
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {memories.map((m) => {
            const isSource = m.slot === sourceSlot;
            const on = !isSource && selected.has(m.slot);
            return (
              <div
                key={m.slot}
                data-mem-slot={m.slot}
                data-mem-disabled={isSource ? "1" : undefined}
                className={`param-row play-state-param has-footer mem-target-card${on ? " is-alert is-selected" : " is-dim"}${isSource ? " readonly" : ""}`}
                style={on ? ({ ["--play-state-color"]: "var(--ok)" } as CSSProperties) : undefined}
                onPointerDown={(e) => onCardPointerDown(e, m.slot)}
              >
                <div className="param-label">
                  <label>{String(m.slot).padStart(2, "0")}</label>
                </div>
                <button
                  type="button"
                  className="play-state-btn"
                  tabIndex={isSource ? -1 : 0}
                  aria-pressed={on}
                  aria-disabled={isSource || undefined}
                  aria-label={
                    isSource
                      ? `Memory ${String(m.slot).padStart(2, "0")} ${m.name || "—"} (source)`
                      : `Memory ${String(m.slot).padStart(2, "0")} ${m.name || "—"}: ${on ? "selected" : "not selected"}`
                  }
                  disabled={isSource}
                >
                  <Icon
                    name={isSource ? "loop" : on ? "checkboxOn" : "checkboxOff"}
                    className="play-state-icon"
                  />
                  <span className="play-state-text">
                    {isSource ? "Source" : on ? "Selected" : "Off"}
                  </span>
                </button>
                <span className="play-state-footer">{m.name || "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected].sort((a, b) => a - b))}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
