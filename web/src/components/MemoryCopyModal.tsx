import { useMemo, useState } from "react";
import {
  emptyMemoryCopySelection,
  memoryCopySelectionHasContent,
  selectAllMemoryCopySelection,
  type MemoryCopySelection,
} from "../presets/memoryClipboard";

function toggleNum(list: number[], n: number, on: boolean): number[] {
  const set = new Set(list);
  if (on) set.add(n);
  else set.delete(n);
  return [...set].sort((a, b) => a - b);
}

function SectionCard({
  title,
  children,
  onSelectAll,
  onClear,
}: {
  title: string;
  children: React.ReactNode;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <section className="mem-copy-card">
      <div className="mem-copy-card-head">
        <h3>{title}</h3>
        <div className="row-actions">
          <button type="button" className="btn ghost" onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" className="btn ghost" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      <div className="mem-copy-card-body">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mem-copy-sub">
      <h4 className="mem-copy-sub-title">{title}</h4>
      <div className="mem-copy-grid">{children}</div>
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id?: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const switchId = id ?? `mem-copy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="mem-copy-switch">
      <label htmlFor={switchId} className="mem-copy-switch-label">
        {label}
      </label>
      <button
        id={switchId}
        type="button"
        role="switch"
        className={`power-switch${checked ? " on" : ""}`}
        aria-checked={checked}
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

const EMPTY_IFX_BANKS = [false, false, false, false] as boolean[];
const FULL_IFX_BANKS = [true, true, true, true] as boolean[];
const EMPTY_IFX_SLOTS = [
  [false, false, false, false],
  [false, false, false, false],
  [false, false, false, false],
  [false, false, false, false],
] as boolean[][];
const FULL_IFX_SLOTS = [
  [true, true, true, true],
  [true, true, true, true],
  [true, true, true, true],
  [true, true, true, true],
] as boolean[][];
const EMPTY_CTL_MODE = [false, false, false, false, false, false, false, false, false];
const FULL_CTL_MODE = [true, true, true, true, true, true, true, true, true];

export function MemoryCopyModal({
  sourceSlot,
  sourceName,
  onCancel,
  onConfirm,
}: {
  sourceSlot: number;
  sourceName: string;
  onCancel: () => void;
  onConfirm: (selection: MemoryCopySelection) => void;
}) {
  const [sel, setSel] = useState<MemoryCopySelection>(() => emptyMemoryCopySelection());
  const canCopy = useMemo(() => memoryCopySelectionHasContent(sel), [sel]);

  function patch(partial: Partial<MemoryCopySelection>) {
    setSel((prev) => ({ ...prev, ...partial, copyAll: false }));
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-sheet mem-copy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mem-copy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mem-copy-modal-head">
          <h2 id="mem-copy-title">
            Copy from {String(sourceSlot).padStart(2, "0")} {sourceName || "—"}
          </h2>
          <div className="mem-copy-global">
            <Toggle
              label="Copy all settings"
              checked={sel.copyAll}
              onChange={(v) => setSel(v ? selectAllMemoryCopySelection() : emptyMemoryCopySelection())}
            />
            <Toggle
              label="Include all WAV files"
              checked={sel.includeAllWav}
              onChange={(v) =>
                setSel((prev) => ({
                  ...prev,
                  includeAllWav: v,
                  includeWav: v || prev.includeWav,
                  copyAll: false,
                }))
              }
            />
          </div>
        </div>

        <div className="mem-copy-modal-body">
          <SectionCard
            title="Loop"
            onSelectAll={() =>
              patch({
                tracks: [1, 2, 3, 4, 5, 6],
                includeWav: true,
                rec: true,
                play: true,
                rhythm: true,
              })
            }
            onClear={() =>
              patch({
                tracks: [],
                includeWav: false,
                rec: false,
                play: false,
                rhythm: false,
              })
            }
          >
            <SubSection title="Tracks">
              {[1, 2, 3, 4, 5, 6].map((t) => (
                <Toggle
                  key={t}
                  label={`Track ${t}`}
                  checked={sel.tracks.includes(t)}
                  onChange={(v) => patch({ tracks: toggleNum(sel.tracks, t, v) })}
                />
              ))}
              <Toggle
                label="Include WAV files"
                checked={sel.includeWav}
                onChange={(v) => patch({ includeWav: v })}
              />
            </SubSection>
            <SubSection title="Record">
              <Toggle label="Record" checked={sel.rec} onChange={(v) => patch({ rec: v })} />
            </SubSection>
            <SubSection title="Play">
              <Toggle label="Play" checked={sel.play} onChange={(v) => patch({ play: v })} />
            </SubSection>
            <SubSection title="Rhythm">
              <Toggle label="Rhythm" checked={sel.rhythm} onChange={(v) => patch({ rhythm: v })} />
            </SubSection>
          </SectionCard>

          <SectionCard
            title="Ctl Func"
            onSelectAll={() =>
              patch({
                ctlModes: [FULL_CTL_MODE, FULL_CTL_MODE, FULL_CTL_MODE],
                ectlCtl: [true, true, true, true],
                ectlExp: [true, true],
              })
            }
            onClear={() =>
              patch({
                ctlModes: [EMPTY_CTL_MODE, EMPTY_CTL_MODE, EMPTY_CTL_MODE],
                ectlCtl: [false, false, false, false],
                ectlExp: [false, false],
              })
            }
          >
            <div className="mem-copy-fx-banks">
              {[1, 2, 3].map((mode) => (
                <div key={mode} className="mem-copy-fx-col">
                  <h4>Mode {mode}</h4>
                  {Array.from({ length: 9 }, (_, i) => i + 1).map((pedal) => (
                    <Toggle
                      key={pedal}
                      id={`ctl-mode-${mode}-pedal-${pedal}`}
                      label={`Pedal ${pedal}`}
                      checked={sel.ctlModes[mode - 1]![pedal - 1]!}
                      onChange={(v) => {
                        const ctlModes = sel.ctlModes.map((row) => [...row]);
                        ctlModes[mode - 1]![pedal - 1] = v;
                        patch({ ctlModes });
                      }}
                    />
                  ))}
                </div>
              ))}
              <div className="mem-copy-fx-col">
                <h4>Ext Ctrl</h4>
                {[1, 2, 3, 4].map((n) => (
                  <Toggle
                    key={`ctl-${n}`}
                    id={`ectl-ctl-${n}`}
                    label={`CTL ${n}`}
                    checked={sel.ectlCtl[n - 1]!}
                    onChange={(v) => {
                      const ectlCtl = [...sel.ectlCtl];
                      ectlCtl[n - 1] = v;
                      patch({ ectlCtl });
                    }}
                  />
                ))}
                {[1, 2].map((n) => (
                  <Toggle
                    key={`exp-${n}`}
                    id={`ectl-exp-${n}`}
                    label={`EXP ${n}`}
                    checked={sel.ectlExp[n - 1]!}
                    onChange={(v) => {
                      const ectlExp = [...sel.ectlExp];
                      ectlExp[n - 1] = v;
                      patch({ ectlExp });
                    }}
                  />
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Assigns"
            onSelectAll={() => patch({ assigns: Array.from({ length: 16 }, (_, i) => i + 1) })}
            onClear={() => patch({ assigns: [] })}
          >
            <div className="mem-copy-grid">
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <Toggle
                  key={n}
                  label={`Assign ${n}`}
                  checked={sel.assigns.includes(n)}
                  onChange={(v) => patch({ assigns: toggleNum(sel.assigns, n, v) })}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Input"
            onSelectAll={() => patch({ inputSetup: true, inputEq: true, inputDynamics: true })}
            onClear={() => patch({ inputSetup: false, inputEq: false, inputDynamics: false })}
          >
            <SubSection title="Setup">
              <Toggle
                label="Setup"
                checked={sel.inputSetup}
                onChange={(v) => patch({ inputSetup: v })}
              />
            </SubSection>
            <SubSection title="EQ">
              <Toggle label="EQ" checked={sel.inputEq} onChange={(v) => patch({ inputEq: v })} />
            </SubSection>
            <SubSection title="Dynamics">
              <Toggle
                label="Dynamics"
                checked={sel.inputDynamics}
                onChange={(v) => patch({ inputDynamics: v })}
              />
            </SubSection>
          </SectionCard>

          <SectionCard
            title="Output"
            onSelectAll={() =>
              patch({ outputSetup: true, routing: true, outputEq: true, masterFx: true })
            }
            onClear={() =>
              patch({ outputSetup: false, routing: false, outputEq: false, masterFx: false })
            }
          >
            <SubSection title="Setup">
              <Toggle
                id="output-setup"
                label="Setup"
                checked={sel.outputSetup}
                onChange={(v) => patch({ outputSetup: v })}
              />
            </SubSection>
            <SubSection title="Routing">
              <Toggle label="Routing" checked={sel.routing} onChange={(v) => patch({ routing: v })} />
            </SubSection>
            <SubSection title="EQ">
              <Toggle
                id="output-eq"
                label="EQ"
                checked={sel.outputEq}
                onChange={(v) => patch({ outputEq: v })}
              />
            </SubSection>
            <SubSection title="Master FX">
              <Toggle
                label="Master FX"
                checked={sel.masterFx}
                onChange={(v) => patch({ masterFx: v })}
              />
            </SubSection>
          </SectionCard>

          <SectionCard
            title="Mixer"
            onSelectAll={() => patch({ mixerInput: true, mixerOutput: true })}
            onClear={() => patch({ mixerInput: false, mixerOutput: false })}
          >
            <SubSection title="Input">
              <Toggle
                id="mixer-input"
                label="Input"
                checked={sel.mixerInput}
                onChange={(v) => patch({ mixerInput: v })}
              />
            </SubSection>
            <SubSection title="Output">
              <Toggle
                id="mixer-output"
                label="Output"
                checked={sel.mixerOutput}
                onChange={(v) => patch({ mixerOutput: v })}
              />
            </SubSection>
          </SectionCard>

          {(
            [
              ["Input FX", "ifxSetup", "ifxBanks", "ifxSlots"],
              ["Track FX", "tfxSetup", "tfxBanks", "tfxSlots"],
            ] as const
          ).map(([title, setupKey, banksKey, slotsKey]) => (
            <SectionCard
              key={title}
              title={title}
              onSelectAll={() =>
                patch({
                  [setupKey]: true,
                  [banksKey]: FULL_IFX_BANKS,
                  [slotsKey]: FULL_IFX_SLOTS,
                })
              }
              onClear={() =>
                patch({
                  [setupKey]: false,
                  [banksKey]: EMPTY_IFX_BANKS,
                  [slotsKey]: EMPTY_IFX_SLOTS,
                })
              }
            >
              <SubSection title="Setup">
                <Toggle
                  id={`${setupKey}-toggle`}
                  label="Setup"
                  checked={sel[setupKey]}
                  onChange={(v) => patch({ [setupKey]: v })}
                />
              </SubSection>
              <div className="mem-copy-fx-banks">
                {(["A", "B", "C", "D"] as const).map((letter, bi) => (
                  <div key={letter} className="mem-copy-fx-col">
                    <h4>Bank {letter}</h4>
                    <Toggle
                      id={`${banksKey}-bank-${letter}`}
                      label="Bank settings"
                      checked={sel[banksKey][bi]!}
                      onChange={(v) => {
                        const banks = [...sel[banksKey]];
                        banks[bi] = v;
                        patch({ [banksKey]: banks });
                      }}
                    />
                    {(["A", "B", "C", "D"] as const).map((slotLetter, si) => (
                      <Toggle
                        key={slotLetter}
                        id={`${slotsKey}-${letter}-fx-${slotLetter}`}
                        label={`FX ${slotLetter}`}
                        checked={sel[slotsKey][bi]![si]!}
                        onChange={(v) => {
                          const slots = sel[slotsKey].map((row) => [...row]);
                          slots[bi]![si] = v;
                          patch({ [slotsKey]: slots });
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!canCopy}
            onClick={() => onConfirm(sel)}
          >
            Copy to clipboard
          </button>
        </div>
      </div>
    </div>
  );
}
