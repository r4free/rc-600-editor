import { useState } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  FX_BANKS,
  IFX_BANK_PARAMS,
  IFX_MODE_SINGLE,
  IFX_SELECTED_BANK,
  IFX_SLOT_PARAMS,
  INPUT_FX_TYPE_OPTIONS,
  fxSlotSection,
  inputFxInsertDef,
  type ParamDef,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { InputFxEditModal } from "./InputFxEditModal";
import { InputFxLibraryModal } from "./InputFxLibraryModal";
import { TrackStateCard, type PatchHandler, type TrackStateView } from "./LoopTab";
const IFX_PAGES = ["setup", ...FX_BANKS] as const;
type IfxPage = (typeof IFX_PAGES)[number];
const IFX_SLOTS = [0, 1, 2, 3] as const;

const PAGES: { id: IfxPage; label: string; icon: IconName }[] = [
  { id: "setup", label: "Setup", icon: "system" },
  { id: "A", label: "Bank A", icon: "mfx" },
  { id: "B", label: "Bank B", icon: "mfx" },
  { id: "C", label: "Bank C", icon: "mfx" },
  { id: "D", label: "Bank D", icon: "mfx" },
];

const slotParam = (tag: string) => IFX_SLOT_PARAMS.find((p) => p.tag === tag)!;

const SLOT_SWITCH_DEF: ParamDef = {
  ...slotParam("A"),
  kind: "enum",
  info: `${slotParam("A").info} ${slotParam("B").info} Click to cycle Off → Toggle → Moment.`,
};
const SLOT_TYPE_DEF = slotParam("C");

const SLOT_SWITCH_VIEW: TrackStateView = {
  label: "Switch",
  variant: "fx-slot-switch",
  states: [
    { icon: "power", text: "Off", title: "This effect is off.", color: "var(--muted)", dim: true },
    { icon: "toggle", text: "Toggle", title: "On. Each press of the switch turns the effect on or off." },
    {
      icon: "moment",
      text: "Moment",
      title: "On. The effect sounds only while the switch is held.",
      color: "#facc15",
      alert: true,
    },
  ],
};

/** Off = 0, Toggle = 1, Moment = 2 (Switch Mode is kept while off). */
function slotSwitchValue(tags: TagMap): number {
  if (num(tags, "A") !== 1) return 0;
  return num(tags, "B") === 1 ? 2 : 1;
}

function slotSwitchTags(value: number): Record<string, string> {
  if (value === 0) return { A: "0" };
  return { A: "1", B: value === 2 ? "1" : "0" };
}

function insertIcon(label: string): IconName {
  if (label.startsWith("MIC")) return "mic";
  if (label.startsWith("INST")) return "guitar";
  return "merge";
}

function insertView(def: ParamDef): TrackStateView {
  return {
    label: "Insert",
    variant: "fx-insert",
    states: (def.options ?? []).map((o) => ({
      icon: insertIcon(o.label),
      text: o.label,
      title: o.value === 0 ? "Applied to all inputs." : `Applied to ${o.label} only.`,
      alert: o.value !== 0,
      color: o.value === 0 ? undefined : "var(--slot-color, #38bdf8)",
    })),
  };
}

const LETTER_ICONS: IconName[] = ["variationA", "variationB", "variationC", "variationD"];

function letterView(label: string, title: (letter: string) => string): TrackStateView {
  return {
    label,
    variant: "fx-letter",
    states: FX_BANKS.map((letter, i) => ({
      icon: LETTER_ICONS[i],
      text: letter,
      title: title(letter),
    })),
  };
}

const SELECTED_BANK_VIEW = letterView(
  "Selected Bank",
  (l) => `The RC-600 plays and edits Input FX bank ${l}.`,
);

const BANK_VIEWS: Record<string, TrackStateView> = {
  A: {
    label: "Switch",
    variant: "fx-switch",
    states: [
      { icon: "mfx", text: "Off", title: "This bank is off.", color: "var(--muted)", dim: true, alert: true },
      { icon: "mfx", text: "On", title: "This bank is on." },
    ],
  },
  B: {
    label: "Mode",
    variant: "fx-mode",
    states: [
      {
        icon: "playSingle",
        text: "Single",
        title: "Only one of FX A–D can be on.",
        color: "#c084fc",
        alert: true,
      },
      { icon: "playMulti", text: "Multi", title: "Several FX in this bank can be on together." },
    ],
  },
  C: letterView("FX Target", (l) => `The expression pedal controls FX ${l}.`),
};

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bankIndex(letter: (typeof FX_BANKS)[number]): number {
  return FX_BANKS.indexOf(letter);
}

function typeLabel(type: number): string {
  return INPUT_FX_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? `Type ${type}`;
}

export function InputFxTab({
  model,
  onPatch,
  sourceSlot,
  memorySlots,
  backupAck,
  saving,
  onCopyToMemories,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  sourceSlot?: number;
  memorySlots?: number[];
  backupAck?: boolean;
  saving?: boolean;
  onCopyToMemories?: (targets: number[]) => void | Promise<void>;
}) {
  const [page, setPage] = usePersistedTab<IfxPage>("ifx", "setup", IFX_PAGES);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(() => new Set());
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [librarySlot, setLibrarySlot] = useState<number | null>(null);
  const bank = page === "setup" ? 0 : bankIndex(page);
  const showCopy =
    sourceSlot !== undefined &&
    memorySlots !== undefined &&
    onCopyToMemories !== undefined;

  function setSetup(tag: string, value: number) {
    onPatch({ type: "ifx", section: "SETUP", tags: { [tag]: String(value) } });
  }

  function collapseOps(bankNo: number, keepSlot: number): PatchOp[] {
    const slots = model.ifxSlots[bankNo] ?? [];
    const ops: PatchOp[] = [];
    for (let s = 0; s < FX_BANKS.length; s++) {
      if (s === keepSlot) continue;
      if (num(slots[s] ?? {}, "A") === 1) {
        ops.push({ type: "ifx", section: fxSlotSection(bankNo, s), tags: { A: "0" } });
      }
    }
    return ops;
  }

  function setBank(bankNo: number, tag: string, value: number) {
    const ops: PatchOp[] = [
      { type: "ifx", section: FX_BANKS[bankNo], tags: { [tag]: String(value) } },
    ];
    if (tag === "B" && value === IFX_MODE_SINGLE) {
      const slots = model.ifxSlots[bankNo] ?? [];
      const target = num(model.ifxBanks[bankNo] ?? {}, "C");
      let keep = num(slots[target] ?? {}, "A") === 1 ? target : slots.findIndex((s) => num(s, "A") === 1);
      if (keep < 0) keep = 0;
      ops.push(...collapseOps(bankNo, keep));
    }
    onPatch(ops);
  }

  function setSlotTags(bankNo: number, slotNo: number, tags: Record<string, string>) {
    const ops: PatchOp[] = [];
    if (tags.A === "1" && num(model.ifxBanks[bankNo] ?? {}, "B") === IFX_MODE_SINGLE) {
      ops.push(...collapseOps(bankNo, slotNo));
    }
    ops.push({ type: "ifx", section: fxSlotSection(bankNo, slotNo), tags });
    onPatch(ops);
  }

  return (
    <div className="ifx-tab">
      {showCopy ? (
      <div className="copy-panel ifx-memory-copy">
        <h3 className="section-title">
          Copy Input FX from memory {sourceSlot}
          <InfoTip
            label="Copy Input FX"
            text="Copies Setup, all banks, and all FX slots into the selected memories. Writes immediately (same as the Copy tab)."
          />
        </h3>
        <div className="targets">
          {memorySlots.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={copyTargets.has(s)}
                disabled={s === sourceSlot}
                onChange={(e) => {
                  const next = new Set(copyTargets);
                  if (e.target.checked) next.add(s);
                  else next.delete(s);
                  setCopyTargets(next);
                }}
              />
              {String(s).padStart(2, "0")}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={!copyTargets.size || !backupAck || saving}
          onClick={() => void onCopyToMemories([...copyTargets].sort((a, b) => a - b))}
        >
          <Icon name="copy" size={14} />
          Apply copy
        </button>
      </div>
      ) : null}

      <div className="tabs tabs-sub" role="tablist" aria-label="Input FX">
        {PAGES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={page === t.id}
            className={`tab ${page === t.id ? "active" : ""}`}
            data-bank={t.id === "setup" ? undefined : t.id}
            onClick={() => setPage(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
        <span className="tabs-help">
          {page === "setup" ? (
            <InfoTip
              label="Input FX Setup"
              text="Selected Bank is the bank the RC-600 plays and edits. SINGLE mode allows only one of FX A–D on."
            />
          ) : (
            <InfoTip
              label="Input FX"
              text="Each FX slot shows the selected effect. Use Edit to change its parameters, or Library to load a preconfigured effect."
            />
          )}
        </span>
      </div>

      {page === "setup" ? (
        <div className="setup-columns">
          <section aria-label="Selected Bank">
            <div className="track-state-cards">
              <TrackStateCard
                id="ifx-selected-bank"
                def={IFX_SELECTED_BANK}
                view={SELECTED_BANK_VIEW}
                value={num(model.ifxSetup, "A", IFX_SELECTED_BANK.default ?? 0)}
                onChange={(v) => setSetup("A", v)}
              />
            </div>
          </section>
          {FX_BANKS.map((letter, i) => (
            <section key={letter} aria-label={`Bank ${letter}`} data-bank={letter}>
              <div className="track-state-cards">
                {IFX_BANK_PARAMS.map((def) => (
                  <TrackStateCard
                    key={def.tag}
                    group={`Bank ${letter}`}
                    id={`ifx-bank-${letter}-${def.tag}`}
                    def={def}
                    view={BANK_VIEWS[def.tag]}
                    value={num(model.ifxBanks[i] ?? {}, def.tag, def.default ?? 0)}
                    onChange={(v) => setBank(i, def.tag, v)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="ifx-slot-grid">
          {IFX_SLOTS.map((slotNo) => {
            const tags = model.ifxSlots[bank]?.[slotNo] ?? {};
            const insertValue = num(tags, "D");
            const insertDef = inputFxInsertDef(model.input, insertValue);
            const insertOptions = insertDef.options ?? [];
            const insertIndex = Math.max(
              0,
              insertOptions.findIndex((o) => o.value === insertValue),
            );
            const type = num(tags, "C");
            const switchValue = slotSwitchValue(tags);
            return (
              <section
                key={slotNo}
                className={`ifx-slot${switchValue === 0 ? " is-off" : ""}`}
                aria-label={`FX ${FX_BANKS[slotNo]}`}
                data-fx-slot={FX_BANKS[slotNo]}
              >
                <div className="ifx-slot-cards">
                  <TrackStateCard
                    group={`FX ${FX_BANKS[slotNo]}`}
                    id={`ifx-slot-${page}-${slotNo}-switch`}
                    def={SLOT_SWITCH_DEF}
                    view={SLOT_SWITCH_VIEW}
                    value={switchValue}
                    onChange={(v) => setSlotTags(bank, slotNo, slotSwitchTags(v))}
                  />
                  <TrackStateCard
                    group={`FX ${FX_BANKS[slotNo]}`}
                    id={`ifx-slot-${page}-${slotNo}-insert`}
                    def={insertDef}
                    view={insertView(insertDef)}
                    value={insertIndex}
                    onChange={(i) =>
                      setSlotTags(bank, slotNo, { D: String(insertOptions[i]?.value ?? 0) })
                    }
                  />
                  <EffectCard
                    group={`FX ${FX_BANKS[slotNo]}`}
                    id={`ifx-slot-${page}-${slotNo}-effect`}
                    type={type}
                    onLibrary={() => setLibrarySlot(slotNo)}
                    onEdit={() => setEditSlot(slotNo)}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {editSlot !== null && page !== "setup" ? (
        <InputFxEditModal
          model={model}
          bank={bank}
          slot={editSlot}
          type={num(model.ifxSlots[bank]?.[editSlot] ?? {}, "C")}
          onPatch={onPatch}
          onClose={() => setEditSlot(null)}
          onOpenLibrary={() => {
            setLibrarySlot(editSlot);
            setEditSlot(null);
          }}
        />
      ) : null}
      {librarySlot !== null && page !== "setup" ? (
        <InputFxLibraryModal
          model={model}
          bank={bank}
          slot={librarySlot}
          onPatch={onPatch}
          onClose={() => setLibrarySlot(null)}
          onOpenEdit={() => {
            setEditSlot(librarySlot);
            setLibrarySlot(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EffectCard({
  id,
  group,
  type,
  onLibrary,
  onEdit,
}: {
  id: string;
  group: string;
  type: number;
  onLibrary: () => void;
  onEdit: () => void;
}) {
  const name = typeLabel(type);
  const thru = type === 0;
  return (
    <div className={`param-row play-state-param is-fx-effect has-footer${thru ? " is-dim" : ""}`}>
      <div className="param-label">
        <label htmlFor={id}>{group}</label>
        <InfoTip label={SLOT_TYPE_DEF.name} text={SLOT_TYPE_DEF.info ?? ""} />
      </div>
      <button
        id={id}
        type="button"
        className="play-state-btn"
        aria-label={`Effect: ${name}. Open effect library`}
        title={`${name}. Click to open the effect library.`}
        onClick={onLibrary}
      >
        <Icon name="mfx" className="play-state-icon" />
        <span className="play-state-text ifx-effect-card-name">{name}</span>
      </button>
      <div className="ifx-effect-card-actions">
        <button type="button" className="btn ghost" title="Open effect library" onClick={onLibrary}>
          <Icon name="library" size={14} />
          Library
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={thru}
          title={thru ? "THRU has no parameters" : `Edit ${name}`}
          onClick={onEdit}
        >
          <Icon name="tune" size={14} />
          Edit
        </button>
      </div>
      <span className="play-state-footer">Effect</span>
    </div>
  );
}
