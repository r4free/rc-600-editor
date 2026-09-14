import { useMemo, useState } from "react";
import {
  INPUT_FX_CATEGORIES,
  inputFxCategory,
  inputFxSeqSection,
  inputFxSection,
  inputFxTypeLabel,
  type InputFxCategory,
} from "@rc600/catalog/input-fx";
import { fxSlotSection } from "@rc600/catalog/params";
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
import { Icon } from "./Icon";
import type { PatchHandler } from "./LoopTab";
import { Modal } from "./Modal";

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
}: {
  model: MemoryModel;
  bank: number;
  slot: number;
  onPatch: PatchHandler;
  onClose: () => void;
}) {
  const [user, setUser] = useState<InputFxPreset[]>(() => loadUserInputFxPresets());
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<"all" | InputFxCategory>("all");
  const [saveName, setSaveName] = useState("");

  const slotTags = model.ifxSlots[bank]?.[slot] ?? {};
  const currentType = num(slotTags, "C");
  const typeSection = inputFxSection(bank, slot, currentType);
  const seqSection = inputFxSeqSection(bank, slot, currentType);

  const visibleFactory = useMemo(
    () => FACTORY_INPUT_FX_PRESETS.filter((p) => matchInputFxPreset(p, filter, category)),
    [filter, category],
  );
  const visibleUser = useMemo(
    () => user.filter((p) => matchInputFxPreset(p, filter, category)),
    [user, filter, category],
  );

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
    onClose();
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

  function deletePreset(id: string) {
    const next = removeUserInputFxPreset(user, id);
    setUser(next);
    saveUserInputFxPresets(next);
  }

  return (
    <Modal title="Effect library" onClose={onClose} wide>
      <div className="ifx-library-toolbar">
        <label className="drum-pad-field drum-preset-filter">
          <Icon name="search" />
          <input
            type="search"
            value={filter}
            placeholder="Filter"
            aria-label="Filter effects"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>
      <div className="drum-preset-cats" role="tablist" aria-label="Effect categories">
        <button
          type="button"
          role="tab"
          className={`drum-preset-cat${category === "all" ? " is-on" : ""}`}
          aria-selected={category === "all"}
          onClick={() => setCategory("all")}
        >
          All
        </button>
        {INPUT_FX_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            className={`drum-preset-cat${category === cat ? " is-on" : ""}`}
            aria-selected={category === cat}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="drum-preset-cols ifx-library-cols">
        <PresetColumn
          title={`Factory (${visibleFactory.length})`}
          empty="No factory effects match the filter."
          presets={visibleFactory}
          onSelect={applyPreset}
        />
        <PresetColumn
          title={`My effects (${visibleUser.length})`}
          empty="No saved effects yet."
          presets={visibleUser}
          onSelect={applyPreset}
          onDelete={deletePreset}
        />
      </div>

      <div className="ifx-library-save">
        <label className="drum-pad-field">
          <span>Save current as</span>
          <input
            type="text"
            value={saveName}
            placeholder={inputFxTypeLabel(currentType)}
            maxLength={40}
            onChange={(e) => setSaveName(e.target.value)}
          />
        </label>
        <button type="button" className="btn primary" onClick={saveCurrent}>
          <Icon name="save" size={14} />
          Save current
        </button>
      </div>
    </Modal>
  );
}

function PresetColumn({
  title,
  empty,
  presets,
  onSelect,
  onDelete,
}: {
  title: string;
  empty: string;
  presets: InputFxPreset[];
  onSelect: (p: InputFxPreset) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <section className="drum-preset-col" aria-label={title}>
      <h3 className="section-title">{title}</h3>
      {presets.length === 0 ? (
        <p className="drum-preset-empty">{empty}</p>
      ) : (
        <div className="drum-preset-chips">
          {presets.map((preset) => (
            <div key={preset.id} className="ifx-preset-chip-row">
              <button
                type="button"
                className="drum-preset-chip"
                onClick={() => onSelect(preset)}
              >
                <span>{preset.name}</span>
                <span className="drum-preset-chip-meta">
                  {preset.category} · {inputFxTypeLabel(preset.type)}
                </span>
              </button>
              {onDelete ? (
                <button
                  type="button"
                  className="btn ghost"
                  aria-label={`Delete ${preset.name}`}
                  onClick={() => onDelete(preset.id)}
                >
                  <Icon name="deleteOutline" size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
