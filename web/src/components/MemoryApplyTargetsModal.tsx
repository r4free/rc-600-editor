import { useState } from "react";

function Toggle({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={`mem-copy-switch${disabled ? " is-disabled" : ""}`}>
      <label htmlFor={id} className="mem-copy-switch-label">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        className={`power-switch${checked ? " on" : ""}`}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="power-switch-track">
          <span className="power-switch-thumb" />
        </span>
        <span className="power-switch-state">{checked ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}

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
  const targets = memories.filter((m) => m.slot !== sourceSlot);

  function setSlot(slot: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(slot);
      else next.delete(slot);
      return next;
    });
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
            selected memories.
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setSelected(new Set(targets.map((m) => m.slot)))}
            >
              Select all
            </button>
            <button type="button" className="btn ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
        <div className="mem-apply-targets">
          {memories.map((m) => {
            const isSource = m.slot === sourceSlot;
            return (
              <Toggle
                key={m.slot}
                id={`mem-apply-target-${m.slot}`}
                label={`${String(m.slot).padStart(2, "0")} ${m.name || "—"}${isSource ? " (source)" : ""}`}
                checked={isSource ? false : selected.has(m.slot)}
                disabled={isSource}
                onChange={(v) => setSlot(m.slot, v)}
              />
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
