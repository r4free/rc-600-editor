import { useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  INPUT_FX_CATEGORIES,
  INPUT_FX_SEQ_TYPES,
  inputFxCategory,
  type InputFxCategory,
} from "@rc600/catalog/input-fx";
import { FX_BANKS, INPUT_FX_TYPE_OPTIONS } from "@rc600/catalog/params";
import { Icon } from "./Icon";
import { CATEGORY_COLORS } from "./InputFxLibraryModal";
import { Modal } from "./Modal";

type Entry = { value: number; label: string; category: InputFxCategory };

const ENTRIES: Entry[] = INPUT_FX_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.value === 0 ? "THRU (bypass)" : o.label,
  category: inputFxCategory(o.value),
}));

export function InputFxTypePickerModal({
  bank,
  slot,
  currentType,
  onPick,
  onClose,
}: {
  bank: number;
  slot: number;
  currentType: number;
  onPick: (type: number) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<InputFxCategory | "all">("all");

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? ENTRIES.filter((e) => e.label.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      : ENTRIES;
  }, [filter]);

  const counts = useMemo(() => {
    const m = new Map<InputFxCategory, number>();
    for (const e of matches) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [matches]);

  const groups = INPUT_FX_CATEGORIES.map((cat) => ({
    cat,
    entries: matches.filter((e) => e.category === cat && (category === "all" || category === cat)),
  })).filter((g) => g.entries.length);

  return createPortal(
    <Modal title="Choose effect" onClose={onClose} wide className="ifx-type-modal">
      <div className="ifx-type-modal-head">
        <span className="ifx-library-target-slot">
          Bank {FX_BANKS[bank]} · FX {FX_BANKS[slot]}
        </span>
        <label className="drum-pad-field drum-preset-filter ifx-library-search">
          <Icon name="search" />
          <input
            type="search"
            value={filter}
            placeholder="Search by effect or category"
            aria-label="Search effects"
            autoFocus
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <div className="ifx-type-modal-cats" role="radiogroup" aria-label="Effect categories">
        <button
          type="button"
          role="radio"
          aria-checked={category === "all"}
          className={`ifx-library-cat${category === "all" ? " is-on" : ""}`}
          onClick={() => setCategory("all")}
        >
          <span className="ifx-library-cat-label">All</span>
          <span className="ifx-library-cat-count">{matches.length}</span>
        </button>
        {INPUT_FX_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="radio"
            aria-checked={category === cat}
            className={`ifx-library-cat${category === cat ? " is-on" : ""}`}
            disabled={!counts.get(cat) && category !== cat}
            style={{ "--cat-color": CATEGORY_COLORS[cat] } as CSSProperties}
            onClick={() => setCategory(cat)}
          >
            <span className="ifx-library-cat-dot" aria-hidden />
            <span className="ifx-library-cat-label">{cat}</span>
            <span className="ifx-library-cat-count">{counts.get(cat) ?? 0}</span>
          </button>
        ))}
      </div>
      {groups.length === 0 ? <p className="ifx-library-empty">No effects match the search.</p> : null}
      {groups.map(({ cat, entries }) => (
        <section key={cat} className="ifx-library-group" aria-label={cat}>
          <h3 className="section-title">
            {cat} <span className="ifx-library-group-count">{entries.length}</span>
          </h3>
          <div className="ifx-library-grid ifx-type-grid">
            {entries.map((e) => {
              const current = e.value === currentType;
              return (
                <div
                  key={e.value}
                  className={`ifx-library-tile${current ? " is-loaded" : ""}`}
                  style={{ "--cat-color": CATEGORY_COLORS[cat] } as CSSProperties}
                >
                  <button
                    type="button"
                    className="ifx-library-tile-main"
                    aria-pressed={current}
                    title={current ? `${e.label} (current)` : `Switch to ${e.label}`}
                    onClick={() => onPick(e.value)}
                  >
                    <span className="ifx-library-tile-name">{e.label}</span>
                    <span className="ifx-library-tile-meta">
                      <span className="ifx-library-cat-dot" aria-hidden />
                      {current ? "Current" : cat}
                      {INPUT_FX_SEQ_TYPES.has(e.value) ? <span className="ifx-type-seq">SEQ</span> : null}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Modal>,
    document.body,
  );
}
