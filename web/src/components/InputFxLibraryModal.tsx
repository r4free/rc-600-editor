import { useMemo, useState, type CSSProperties } from "react";
import {
  INPUT_FX_CATEGORIES,
  inputFxCategory,
  inputFxSeqSection,
  inputFxSection,
  inputFxTypeLabel,
  type InputFxCategory,
} from "@rc600/catalog/input-fx";
import { FX_BANKS, fxSlotSection } from "@rc600/catalog/params";
import type { MemoryModel } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import {
  FACTORY_INPUT_FX_PRESETS,
  loadUserInputFxPresets,
  matchInputFxPreset,
  newUserPresetId,
  removeUserInputFxPreset,
  saveUserInputFxPresets,
  upsertUserInputFxPreset,
  type InputFxPreset,
} from "../presets/inputFxPreset";
import { captureInputFxPresets, type CaptureMemory } from "../presets/inputFxCapture";
import { Icon } from "./Icon";
import { useDemoMode } from "../demoModeContext";
import type { PatchHandler } from "./LoopTab";
import { Modal } from "./Modal";

type Source = "all" | "factory" | "user";

const SOURCES: { id: Source; label: string }[] = [
  { id: "all", label: "All" },
  { id: "factory", label: "Factory" },
  { id: "user", label: "My effects" },
];

const CATEGORY_COLORS: Record<InputFxCategory, string> = {
  Filter: "#38bdf8",
  Modulation: "#a78bfa",
  Pitch: "#f472b6",
  Vocal: "#fb923c",
  Amp: "#ef4444",
  Dynamics: "#facc15",
  Slicer: "#2dd4bf",
  Delay: "#60a5fa",
  Reverb: "#818cf8",
  Other: "#94a3b8",
};

function num(tags: Record<string, string | undefined>, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function InputFxLibraryModal({
  model,
  bank,
  slot,
  onPatch,
  onClose,
  onOpenEdit,
  pedalMemories,
}: {
  model: MemoryModel;
  bank: number;
  slot: number;
  onPatch: PatchHandler;
  onClose: () => void;
  onOpenEdit: () => void;
  pedalMemories?: () => CaptureMemory[];
}) {
  const viewOnly = useDemoMode();
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [user, setUser] = useState<InputFxPreset[]>(() => loadUserInputFxPresets());
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<"all" | InputFxCategory>("all");
  const [source, setSource] = useState<Source>("all");
  const [saveName, setSaveName] = useState("");

  const slotTags = model.ifxSlots[bank]?.[slot] ?? {};
  const currentType = num(slotTags, "C");
  const typeSection = inputFxSection(bank, slot, currentType);
  const seqSection = inputFxSeqSection(bank, slot, currentType);

  const pool = useMemo(() => {
    const factory = source === "user" ? [] : FACTORY_INPUT_FX_PRESETS;
    const mine = source === "factory" ? [] : user;
    return [...mine, ...factory].filter((p) => matchInputFxPreset(p, filter, "all"));
  }, [filter, source, user]);

  const counts = useMemo(() => {
    const out = new Map<InputFxCategory, number>();
    for (const p of pool) out.set(p.category, (out.get(p.category) ?? 0) + 1);
    return out;
  }, [pool]);

  const visible = useMemo(
    () => (category === "all" ? pool : pool.filter((p) => p.category === category)),
    [pool, category],
  );
  const visibleUser = visible.filter((p) => p.source === "user");
  const visibleFactory = visible.filter((p) => p.source === "factory");

  function applyPreset(preset: InputFxPreset) {
    const ops: PatchOp[] = [
      {
        type: "ifx",
        section: fxSlotSection(bank, slot),
        tags: { C: String(preset.type) },
      },
    ];
    const blockSec = inputFxSection(bank, slot, preset.type);
    if (blockSec && Object.keys(preset.tags).length) {
      ops.push({ type: "ifx", section: blockSec, tags: { ...preset.tags } });
    }
    const seqSec = inputFxSeqSection(bank, slot, preset.type);
    if (seqSec && preset.seqTags && Object.keys(preset.seqTags).length) {
      ops.push({ type: "ifx", section: seqSec, tags: { ...preset.seqTags } });
    }
    onPatch(ops);
    setLoadedId(preset.id);
  }

  function saveCurrent() {
    const name = saveName.trim() || `${inputFxTypeLabel(currentType)} custom`;
    const tags = typeSection ? { ...(model.ifxBlocks[typeSection] ?? {}) } : {};
    const seqTags =
      seqSection && model.ifxBlocks[seqSection]
        ? { ...model.ifxBlocks[seqSection] }
        : undefined;
    const preset: InputFxPreset = {
      id: newUserPresetId(name),
      name,
      category: inputFxCategory(currentType),
      source: "user",
      type: currentType,
      tags,
      seqTags,
    };
    const next = upsertUserInputFxPreset(user, preset);
    setUser(next);
    saveUserInputFxPresets(next);
    setSaveName("");
  }

  function captureFromPedal() {
    const memories = pedalMemories?.() ?? [];
    if (!memories.length) {
      setCaptureStatus("No memories loaded. Open the ROLAND folder from the pedal first.");
      return;
    }
    const result = captureInputFxPresets(memories, user);
    if (result.added) {
      setUser(result.presets);
      saveUserInputFxPresets(result.presets);
      setSource("user");
      setCategory("all");
      setFilter("");
    }
    const memLabel = `${result.memories} ${result.memories === 1 ? "memory" : "memories"}`;
    const dupLabel = result.duplicates
      ? ` ${result.duplicates} already in My effects or repeated, skipped.`
      : "";
    setCaptureStatus(
      result.added
        ? `Captured ${result.added} ${result.added === 1 ? "effect" : "effects"} from ${memLabel}.${dupLabel}`
        : `No new effects in ${memLabel}.${dupLabel}`,
    );
  }

  function deletePreset(id: string) {
    const next = removeUserInputFxPreset(user, id);
    setUser(next);
    saveUserInputFxPresets(next);
  }

  const foot = (
    <form
      className="ifx-library-save"
      onSubmit={(e) => {
        e.preventDefault();
        saveCurrent();
      }}
    >
      <label className="drum-pad-field">
        <span>Save current effect as</span>
        <input
          type="text"
          value={saveName}
          placeholder={`${inputFxTypeLabel(currentType)} custom`}
          maxLength={40}
          onChange={(e) => setSaveName(e.target.value)}
        />
      </label>
      <button type="submit" className="btn primary">
        <Icon name="save" size={14} />
        Save to My effects
      </button>
    </form>
  );

  return (
    <Modal
      title="Effect library"
      onClose={onClose}
      wide
      className="ifx-library-modal"
      foot={viewOnly ? undefined : foot}
      actions={
        <>
          {pedalMemories && !viewOnly ? (
            <button
              type="button"
              className="btn"
              title="Read the input effects of every memory on the pedal and save them to My effects. Effects already saved are skipped."
              onClick={captureFromPedal}
            >
              <Icon name="download" size={14} />
              Capture from pedal
            </button>
          ) : null}
          <button type="button" className="btn" title="Edit the current effect" onClick={onOpenEdit}>
            <Icon name="tune" size={14} />
            Edit
          </button>
        </>
      }
    >
      {captureStatus ? (
        <p className="ifx-library-capture-status" role="status">
          <Icon name="download" size={14} />
          {captureStatus}
        </p>
      ) : null}
      <div className="ifx-library-head">
        <div className="ifx-library-target">
          <span className="ifx-library-target-slot">
            Bank {FX_BANKS[bank]} · FX {FX_BANKS[slot]}
          </span>
          <span className="ifx-library-target-current">
            Current: <strong>{inputFxTypeLabel(currentType)}</strong>
          </span>
        </div>
        <label className="drum-pad-field drum-preset-filter ifx-library-search">
          <Icon name="search" />
          <input
            type="search"
            value={filter}
            placeholder="Search by name, type or category"
            aria-label="Search effects"
            autoFocus
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <div className="ifx-library-sources" role="radiogroup" aria-label="Source">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={source === s.id}
              className={`drum-preset-cat${source === s.id ? " is-on" : ""}`}
              onClick={() => setSource(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ifx-library-layout">
        <nav className="ifx-library-cats" aria-label="Effect categories">
          <CategoryButton
            label="All"
            count={pool.length}
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {INPUT_FX_CATEGORIES.map((cat) => (
            <CategoryButton
              key={cat}
              label={cat}
              color={CATEGORY_COLORS[cat]}
              count={counts.get(cat) ?? 0}
              active={category === cat}
              onClick={() => setCategory(cat)}
            />
          ))}
        </nav>

        <div className="ifx-library-results">
          {visible.length === 0 ? (
            <p className="ifx-library-empty">
              {source === "user" && user.length === 0
                ? "No saved effects yet. Use Save to My effects below to keep the current effect."
                : "No effects match the search."}
            </p>
          ) : null}
          {visibleUser.length ? (
            <PresetGroup
              title="My effects"
              presets={visibleUser}
              currentType={currentType}
              loadedId={loadedId}
              onSelect={applyPreset}
              onDelete={viewOnly ? undefined : deletePreset}
            />
          ) : null}
          {visibleFactory.length ? (
            <PresetGroup
              title="Factory"
              presets={visibleFactory}
              currentType={currentType}
              loadedId={loadedId}
              onSelect={applyPreset}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function CategoryButton({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ifx-library-cat${active ? " is-on" : ""}`}
      aria-pressed={active}
      disabled={count === 0 && !active}
      style={color ? ({ "--cat-color": color } as CSSProperties) : undefined}
      onClick={onClick}
    >
      <span className="ifx-library-cat-dot" aria-hidden />
      <span className="ifx-library-cat-label">{label}</span>
      <span className="ifx-library-cat-count">{count}</span>
    </button>
  );
}

function PresetGroup({
  title,
  presets,
  currentType,
  loadedId,
  onSelect,
  onDelete,
}: {
  title: string;
  presets: InputFxPreset[];
  currentType: number;
  loadedId: string | null;
  onSelect: (p: InputFxPreset) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <section className="ifx-library-group" aria-label={title}>
      <h3 className="section-title">
        {title} <span className="ifx-library-group-count">{presets.length}</span>
      </h3>
      <div className="ifx-library-grid">
        {presets.map((preset) => (
          <div
            key={preset.id}
            className={`ifx-library-tile${preset.type === currentType ? " is-current-type" : ""}${preset.id === loadedId ? " is-loaded" : ""}`}
            style={{ "--cat-color": CATEGORY_COLORS[preset.category] } as CSSProperties}
          >
            <button
              type="button"
              className="ifx-library-tile-main"
              aria-pressed={preset.id === loadedId}
              title={`Load ${preset.name}`}
              onClick={() => onSelect(preset)}
            >
              <span className="ifx-library-tile-name">{preset.name}</span>
              <span className="ifx-library-tile-meta">
                <span className="ifx-library-cat-dot" aria-hidden />
                {preset.category} · {inputFxTypeLabel(preset.type)}
              </span>
            </button>
            {onDelete ? (
              <button
                type="button"
                className="btn ghost ifx-library-tile-delete"
                aria-label={`Delete ${preset.name}`}
                title={`Delete ${preset.name}`}
                onClick={() => onDelete(preset.id)}
              >
                <Icon name="deleteOutline" size={14} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
