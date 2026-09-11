import { useState } from "react";
import {
  FX_BANKS,
  IFX_BANK_PARAMS,
  IFX_MODE_SINGLE,
  IFX_SELECTED_BANK,
  IFX_SLOT_PARAMS,
  fxSlotSection,
  inputFxInsertDef,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { patchIfxSection } from "@rc600/rc0/memory";
import { Icon, type IconName } from "./Icon";
import { ParamControl } from "./ParamControl";

type IfxPage = "setup" | (typeof FX_BANKS)[number];

const PAGES: { id: IfxPage; label: string; icon: IconName }[] = [
  { id: "setup", label: "Setup", icon: "system" },
  { id: "A", label: "Bank A", icon: "mfx" },
  { id: "B", label: "Bank B", icon: "mfx" },
  { id: "C", label: "Bank C", icon: "mfx" },
  { id: "D", label: "Bank D", icon: "mfx" },
];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bankIndex(letter: (typeof FX_BANKS)[number]): number {
  return FX_BANKS.indexOf(letter);
}

export function InputFxTab({
  model,
  xml,
  onXml,
}: {
  model: MemoryModel;
  xml: string;
  onXml: (next: string) => void;
}) {
  const [page, setPage] = useState<IfxPage>("setup");
  const [slot, setSlot] = useState(0);
  const bank = page === "setup" ? 0 : bankIndex(page);
  const slotTags = model.ifxSlots[bank]?.[slot] ?? {};
  const insertValue = num(slotTags, "D");

  function setSetup(tag: string, value: number) {
    onXml(patchIfxSection(xml, "SETUP", { [tag]: String(value) }));
  }

  function collapseToSingle(next: string, bankNo: number, keepSlot: number): string {
    const slots = model.ifxSlots[bankNo] ?? [];
    let out = next;
    for (let s = 0; s < FX_BANKS.length; s++) {
      if (s === keepSlot) continue;
      if (num(slots[s] ?? {}, "A") === 1) {
        out = patchIfxSection(out, fxSlotSection(bankNo, s), { A: "0" });
      }
    }
    return out;
  }

  function setBank(bankNo: number, tag: string, value: number) {
    let next = patchIfxSection(xml, FX_BANKS[bankNo], { [tag]: String(value) });
    if (tag === "B" && value === IFX_MODE_SINGLE) {
      const slots = model.ifxSlots[bankNo] ?? [];
      const target = num(model.ifxBanks[bankNo] ?? {}, "C");
      let keep = num(slots[target] ?? {}, "A") === 1 ? target : slots.findIndex((s) => num(s, "A") === 1);
      if (keep < 0) keep = 0;
      next = collapseToSingle(next, bankNo, keep);
    }
    onXml(next);
  }

  function setSlotParam(bankNo: number, slotNo: number, tag: string, value: number) {
    let next = xml;
    if (tag === "A" && value === 1 && num(model.ifxBanks[bankNo] ?? {}, "B") === IFX_MODE_SINGLE) {
      next = collapseToSingle(next, bankNo, slotNo);
    }
    onXml(patchIfxSection(next, fxSlotSection(bankNo, slotNo), { [tag]: String(value) }));
  }

  return (
    <div className="ifx-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="Input FX">
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
                id="ifx-selected-bank"
                def={IFX_SELECTED_BANK}
                value={num(model.ifxSetup, "A", IFX_SELECTED_BANK.default ?? 0)}
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
                    id={`ifx-bank-${letter}-${def.tag}`}
                    def={def}
                    value={num(model.ifxBanks[i] ?? {}, def.tag, def.default ?? 0)}
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
            Effect-type parameters (rate, depth, and so on) come in a later pass.
          </p>
          <div className="tabs tabs-sub" role="tablist" aria-label={`Bank ${page} FX`}>
            {FX_BANKS.map((letter, i) => (
              <button
                key={letter}
                type="button"
                role="tab"
                aria-selected={slot === i}
                className={`tab ${slot === i ? "active" : ""}`}
                onClick={() => setSlot(i)}
              >
                <Icon name="chorus" size={14} />
                FX {letter}
              </button>
            ))}
          </div>
          <section>
            <h3 className="section-title">
              Bank {page} · FX {FX_BANKS[slot]}
            </h3>
            <div className="param-columns">
              {IFX_SLOT_PARAMS.map((def) => {
                const current = def.tag === "D" ? insertValue : num(slotTags, def.tag, def.default ?? 0);
                const shown = def.tag === "D" ? inputFxInsertDef(model.input, insertValue) : def;
                return (
                  <ParamControl
                    key={def.tag}
                    id={`ifx-slot-${page}-${slot}-${def.tag}`}
                    def={shown}
                    value={current}
                    onChange={(v) => setSlotParam(bank, slot, def.tag, v)}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
