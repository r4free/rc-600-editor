import { useState } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  FX_BANKS,
  IFX_BANK_PARAMS,
  IFX_MODE_SINGLE,
  IFX_SELECTED_BANK,
  TFX_SLOT_PARAMS,
  TRACK_FX_TYPE_OPTIONS,
  fxSlotSection,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { Icon, type IconName } from "./Icon";
import { TrackFxEditModal } from "./TrackFxEditModal";
import { TrackFxLibraryModal } from "./TrackFxLibraryModal";
import type { PatchHandler } from "./LoopTab";
import { ParamControl } from "./ParamControl";

const TFX_PAGES = ["setup", ...FX_BANKS] as const;
type TfxPage = (typeof TFX_PAGES)[number];
const TFX_SLOTS = [0, 1, 2, 3] as const;

const PAGES: { id: TfxPage; label: string; icon: IconName }[] = [
  { id: "setup", label: "Setup", icon: "system" },
  { id: "A", label: "Bank A", icon: "mfx" },
  { id: "B", label: "Bank B", icon: "mfx" },
  { id: "C", label: "Bank C", icon: "mfx" },
  { id: "D", label: "Bank D", icon: "mfx" },
];

const SLOT_SHELL_PARAMS = TFX_SLOT_PARAMS.filter((p) => p.tag !== "C");

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
  return TRACK_FX_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? `Type ${type}`;
}

export function TrackFxTab({
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
  const [page, setPage] = usePersistedTab<TfxPage>("tfx", "setup", TFX_PAGES);
  const [copyTargets, setCopyTargets] = useState<Set<number>>(() => new Set());
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [librarySlot, setLibrarySlot] = useState<number | null>(null);
  const bank = page === "setup" ? 0 : bankIndex(page);
  const showCopy =
    sourceSlot !== undefined &&
    memorySlots !== undefined &&
    onCopyToMemories !== undefined;

  function setSetup(tag: string, value: number) {
    onPatch({ type: "tfx", section: "SETUP", tags: { [tag]: String(value) } });
  }

  function collapseOps(bankNo: number, keepSlot: number): PatchOp[] {
    const slots = model.tfxSlots[bankNo] ?? [];
    const ops: PatchOp[] = [];
    for (let s = 0; s < FX_BANKS.length; s++) {
      if (s === keepSlot) continue;
      if (num(slots[s] ?? {}, "A") === 1) {
        ops.push({ type: "tfx", section: fxSlotSection(bankNo, s), tags: { A: "0" } });
      }
    }
    return ops;
  }

  function setBank(bankNo: number, tag: string, value: number) {
    const ops: PatchOp[] = [
      { type: "tfx", section: FX_BANKS[bankNo], tags: { [tag]: String(value) } },
    ];
    if (tag === "B" && value === IFX_MODE_SINGLE) {
      const slots = model.tfxSlots[bankNo] ?? [];
      const target = num(model.tfxBanks[bankNo] ?? {}, "C");
      let keep = num(slots[target] ?? {}, "A") === 1 ? target : slots.findIndex((s) => num(s, "A") === 1);
      if (keep < 0) keep = 0;
      ops.push(...collapseOps(bankNo, keep));
    }
    onPatch(ops);
  }

  function setSlotParam(bankNo: number, slotNo: number, tag: string, value: number) {
    const ops: PatchOp[] = [];
    if (tag === "A" && value === 1 && num(model.tfxBanks[bankNo] ?? {}, "B") === IFX_MODE_SINGLE) {
      ops.push(...collapseOps(bankNo, slotNo));
    }
    ops.push({
      type: "tfx",
      section: fxSlotSection(bankNo, slotNo),
      tags: { [tag]: String(value) },
    });
    onPatch(ops);
  }

  return (
    <div className="ifx-tab tfx-tab">
      {showCopy ? (
      <div className="copy-panel ifx-memory-copy">
        <h3 className="section-title">Copy Track FX from memory {sourceSlot}</h3>
        <p className="hint">
          Copies Setup, all banks, and all FX slots into the selected memories. Writes immediately
          (same as the Copy tab).
        </p>
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

      <div className="tabs tabs-sub" role="tablist" aria-label="Track FX">
        {PAGES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={page === t.id}
            className={`tab ${page === t.id ? "active" : ""}`}
            onClick={() => setPage(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {page === "setup" ? (
        <>
          <p className="hint">
            Selected Bank is the bank the RC-600 plays and edits. SINGLE mode allows only one of FX
            A–D on.
          </p>
          <section>
            <h3 className="section-title">Setup</h3>
            <div className="param-columns">
              <ParamControl
                id="tfx-selected-bank"
                def={IFX_SELECTED_BANK}
                value={num(model.tfxSetup, "A", IFX_SELECTED_BANK.default ?? 0)}
                onChange={(v) => setSetup("A", v)}
              />
            </div>
          </section>
          {FX_BANKS.map((letter, i) => (
            <section key={letter}>
              <h3 className="section-title">Bank {letter}</h3>
              <div className="param-columns">
                {IFX_BANK_PARAMS.map((def) => (
                  <ParamControl
                    key={def.tag}
                    id={`tfx-bank-${letter}-${def.tag}`}
                    def={def}
                    value={num(model.tfxBanks[i] ?? {}, def.tag, def.default ?? 0)}
                    onChange={(v) => setBank(i, def.tag, v)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <>
          <p className="hint">
            Each FX slot shows the selected effect. Use Edit to change its parameters, or Library to
            load a preconfigured effect. Beat Scatter, Beat Repeat, Beat Shift, and Vinyl Flick are
            Track FX only; in MULTI mode they work on FX A.
          </p>
          {TFX_SLOTS.map((slotNo) => {
            const tags = model.tfxSlots[bank]?.[slotNo] ?? {};
            const type = num(tags, "C");
            const effectName = typeLabel(type);
            return (
              <section key={slotNo}>
                <h3 className="section-title">FX {FX_BANKS[slotNo]}</h3>
                <div className="param-columns">
                  {SLOT_SHELL_PARAMS.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`tfx-slot-${page}-${slotNo}-${def.tag}`}
                      def={def}
                      value={num(tags, def.tag, def.default ?? 0)}
                      onChange={(v) => setSlotParam(bank, slotNo, def.tag, v)}
                    />
                  ))}
                  <div className="param-row ifx-effect-row">
                    <div className="param-label">
                      <span>Effect</span>
                    </div>
                    <div className="param-control ifx-effect-control">
                      <span className="ifx-effect-name" title={effectName}>
                        {effectName}
                      </span>
                      <button
                        type="button"
                        className="btn"
                        disabled={type === 0}
                        title={type === 0 ? "THRU has no parameters" : `Edit ${effectName}`}
                        onClick={() => setEditSlot(slotNo)}
                      >
                        <Icon name="tune" size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        title="Open effect library"
                        onClick={() => setLibrarySlot(slotNo)}
                      >
                        <Icon name="library" size={14} />
                        Library
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </>
      )}

      {editSlot !== null && page !== "setup" ? (
        <TrackFxEditModal
          model={model}
          bank={bank}
          slot={editSlot}
          type={num(model.tfxSlots[bank]?.[editSlot] ?? {}, "C")}
          onPatch={onPatch}
          onClose={() => setEditSlot(null)}
        />
      ) : null}
      {librarySlot !== null && page !== "setup" ? (
        <TrackFxLibraryModal
          model={model}
          bank={bank}
          slot={librarySlot}
          onPatch={onPatch}
          onClose={() => setLibrarySlot(null)}
        />
      ) : null}
    </div>
  );
}
