import { useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { INPUT_FX_CATEGORIES, INPUT_FX_SEQ_TYPES, inputFxCategory } from "@rc600/catalog/input-fx";
import { FX_BANKS, INPUT_FX_TYPE_OPTIONS, TRACK_FX_TYPE_OPTIONS } from "@rc600/catalog/params";
import { TRACK_FX_CATEGORIES, trackFxCategory, type TrackFxCategory } from "@rc600/catalog/track-fx";
import { Icon } from "./Icon";
import { CATEGORY_COLORS } from "./InputFxLibraryModal";
import { Modal } from "./Modal";

type Entry = { value: number; label: string; category: TrackFxCategory };

const BEAT_COLOR = "#f97316";

function categoryColor(cat: TrackFxCategory): string {
  return cat === "Beat" ? BEAT_COLOR : CATEGORY_COLORS[cat];
}

const INPUT_ENTRIES: Entry[] = INPUT_FX_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.value === 0 ? "THRU (bypass)" : o.label,
  category: inputFxCategory(o.value),
}));

const TRACK_ENTRIES: Entry[] = TRACK_FX_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.value === 0 ? "THRU (bypass)" : o.label,
  category: trackFxCategory(o.value),
}));

export function InputFxTypePickerModal({
  kind = "ifx",
  bank,
  slot,
  currentType,
  onPick,
  onClose,
}: {
  kind?: "ifx" | "tfx";
  bank: number;
  slot: number;
  currentType: number;
  onPick: (type: number) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<TrackFxCategory | "all">("all");
  const entries = kind === "tfx" ? TRACK_ENTRIES : INPUT_ENTRIES;
  const categories: TrackFxCategory[] = kind === "tfx" ? TRACK_FX_CATEGORIES : INPUT_FX_CATEGORIES;

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q
      ? entries.filter((e) => e.label.toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
      : entries;
  }, [filter, entries]);

  const counts = useMemo(() => {
    const m = new Map<TrackFxCategory, number>();
    for (const e of matches) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return m;
  }, [matches]);

  const groups = categories.map((cat) => ({
    cat,
    entries: matches.filter((e) => e.category === cat && (category === "all" || category === cat)),
  })).filter((g) => g.entries.length);

  return createPortal(
    <Modal title="Choose effect" onClose={onClose} wide className="ifx-type-modal">
      <div className="ifx-type-modal-head">
        <span className="ifx-library-target-slot">
          {kind === "tfx" ? "Track FX · " : ""}Bank {FX_BANKS[bank]} · FX {FX_BANKS[slot]}
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
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            role="radio"
            aria-checked={category === cat}
            className={`ifx-library-cat${category === cat ? " is-on" : ""}`}
            disabled={!counts.get(cat) && category !== cat}
            style={{ "--cat-color": categoryColor(cat) } as CSSProperties}
            onClick={() => setCategory(cat)}
          >
            <span className="ifx-library-cat-dot" aria-hidden />
            <span className="ifx-library-cat-label">{cat}</span>
            <span className="ifx-library-cat-count">{counts.get(cat) ?? 0}</span>
          </button>
        ))}
      </div>
      {groups.length === 0 ? <p className="ifx-library-empty">No effects match the search.</p> : null}
      {groups.map(({ cat, entries: list }) => (
        <section key={cat} className="ifx-library-group" aria-label={cat}>
          <h3 className="section-title">
            {cat} <span className="ifx-library-group-count">{list.length}</span>
          </h3>
          <div className="ifx-library-grid ifx-type-grid">
            {list.map((e) => {
              const current = e.value === currentType;
              return (
                <div
                  key={e.value}
                  className={`ifx-library-tile${current ? " is-loaded" : ""}`}
                  style={{ "--cat-color": categoryColor(cat) } as CSSProperties}
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
                      {cat === "Beat" ? <span className="ifx-type-seq">TRACK</span> : null}
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
