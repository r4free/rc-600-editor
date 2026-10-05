import type { CSSProperties } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  ctlFunctionInfo,
  expFunctionInfo,
  PREF_CTL_GROUP,
  PREF_ALL_CLEAR,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { CtlFunctionSelect, EXP_CATALOG, ctlFunctionColor, type FunctionCatalog } from "./CtlFunctionSelect";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { preferenceView } from "./InputTab";
import { ScrubCard, TrackStateCard, onOffView, type PatchHandler } from "./LoopTab";
import { ParamControl } from "./ParamControl";

const CTL_SUBS_WITH_PREF = ["mode1", "mode2", "mode3", "ext", "pref"] as const;
type CtlSub = (typeof CTL_SUBS_WITH_PREF)[number];

const SUBS: { id: CtlSub; label: string; icon: IconName }[] = [
  { id: "mode1", label: "Mode 1", icon: "controls" },
  { id: "mode2", label: "Mode 2", icon: "controls" },
  { id: "mode3", label: "Mode 3", icon: "controls" },
  { id: "ext", label: "Ext Ctrl", icon: "external" },
];

/** Reading order from the top-left switch. Desktop places 7–9 above 1–6. */
const PEDALS: { pedal: number; role: string }[] = [
  { pedal: 7, role: "Track Select" },
  { pedal: 8, role: "Undo/Redo" },
  { pedal: 9, role: "All Start/Stop" },
  { pedal: 1, role: "REC/PLAY" },
  { pedal: 2, role: "STOP" },
  { pedal: 3, role: "REC/PLAY" },
  { pedal: 4, role: "STOP" },
  { pedal: 5, role: "REC/PLAY" },
  { pedal: 6, role: "STOP" },
];
const EXT_JACKS = [
  { title: "CTL 1, 2 / EXP 1", ctls: [1, 2], exp: 1 },
  { title: "CTL 3, 4 / EXP 2", ctls: [3, 4], exp: 2 },
] as const;
const CTL_GESTURES = [
  { tag: "A", name: "Push", info: "Functions when the switch is pressed." },
  { tag: "B", name: "Hold", info: "Functions when the switch is held down." },
  { tag: "C", name: "Click", info: "Functions when the switch is double-clicked." },
] as const;
function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function patchPedalFunction(tags: TagMap, nextFn: number): Record<string, string> {
  const patch: Record<string, string> = { A: String(nextFn) };
  const c = num(tags, "C", 0);
  if (nextFn === 0) patch.C = "0";
  else if (c === 0) patch.C = "1";
  return patch;
}

export function ControlTab({
  model,
  onPatch,
  scope = "mem",
  preference,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  scope?: "mem" | "sys";
  preference?: { tags: TagMap; onChange: (tag: string, value: number) => void };
}) {
  const subs = preference
    ? [...SUBS, { id: "pref" as const, label: "Preference", icon: "system" as IconName }]
    : SUBS;
  const [sub, setSub] = usePersistedTab<CtlSub>(`ctl.${scope}`, "mode1", CTL_SUBS_WITH_PREF);
  const visibleSub = !preference && sub === "pref" ? "mode1" : sub;
  const modeNo = visibleSub === "mode1" ? 1 : visibleSub === "mode2" ? 2 : visibleSub === "mode3" ? 3 : 0;
  const prefNote = preference ? "" : " MEMORY vs SYSTEM preference lives in System → Ctl Func → Preference.";
  const helpLabel =
    visibleSub === "pref" ? "Preference" : visibleSub === "ext" ? "Ext Ctrl" : `Mode ${modeNo}`;
  const helpText =
    visibleSub === "pref"
      ? "MEMORY uses the Ctl Func settings stored in each memory. SYSTEM uses these global defaults."
      : visibleSub === "ext"
        ? `Footswitches and expression pedals on CTL 1, 2 / EXP 1 and CTL 3, 4 / EXP 2. Push, hold, and double-click can each take a CTL FUNC.${prefNote}`
        : `The nine onboard switches in pedal mode ${modeNo}, in the same order as on the RC-600. On a wide screen, Track Select, Undo/Redo and All Start/Stop sit on top and the six switches below run left to right. On a narrow screen they follow that order from the top left. The name under a card is printed on the unit. The center is the function assigned now. Click a card to search for another function.${prefNote}`;

  return (
    <div className="ctl-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="Ctl Func">
        {subs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={visibleSub === t.id}
            className={`tab ${visibleSub === t.id ? "active" : ""}`}
            onClick={() => setSub(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
        <span className="tabs-help">
          <InfoTip label={helpLabel} text={helpText} />
        </span>
      </div>

      {visibleSub === "pref" && preference ? (
        <div className="track-state-cards" aria-label="Preference">
          {PREF_CTL_GROUP.params.map((def) => (
            <TrackStateCard
              key={def.tag}
              id={`ctl-pref-${def.tag}`}
              def={def}
              view={preferenceView(def.name)}
              value={num(preference.tags, def.tag, def.default ?? 0)}
              onChange={(v) => preference.onChange(def.tag, v)}
            />
          ))}
          <TrackStateCard
            id="ctl-pref-allclear"
            def={PREF_ALL_CLEAR}
            view={onOffView(
              "All Clear",
              "trash",
              "Long-pressing ALL START/STOP does not clear the tracks.",
              "Long-pressing ALL START/STOP clears all tracks.",
            )}
            value={num(preference.tags, PREF_ALL_CLEAR.tag, PREF_ALL_CLEAR.default ?? 0)}
            onChange={(v) => preference.onChange(PREF_ALL_CLEAR.tag, v)}
          />
        </div>
      ) : null}

      {modeNo ? (
        <div className="ctl-pedal-board" aria-label="Onboard switches">
          {PEDALS.map(({ pedal, role }) => {
            const tags = model.ctlPedals[modeNo - 1]?.[pedal - 1] ?? {};
            const value = num(tags, "A", 0);
            const color = ctlFunctionColor(value);
            const info = ctlFunctionInfo(value) ?? "Stored value with no name in the function list.";
            return (
              <div
                key={pedal}
                data-pedal={pedal}
                className={`param-row play-state-param ctl-pedal has-footer${value === 0 ? " is-dim" : " is-alert"}`}
                style={{ "--play-state-color": color ?? "var(--muted)" } as CSSProperties}
              >
                <div className="param-label">
                  <label htmlFor={`ictl-${modeNo}-p${pedal}-a`}>Pedal {pedal}</label>
                  <InfoTip label={`Pedal ${pedal}`} text={`${role} on the unit. ${info}`} />
                </div>
                <CtlFunctionSelect
                  id={`ictl-${modeNo}-p${pedal}-a`}
                  value={value}
                  ariaLabel={`Pedal ${pedal}, ${role}`}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: `ICTL${modeNo}_PEDAL${pedal}`,
                      tags: patchPedalFunction(tags, v),
                      scope,
                    })
                  }
                />
                <span className="play-state-footer">{role}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {visibleSub === "ext" ? <ExtCtrlEditor model={model} onPatch={onPatch} scope={scope} /> : null}
    </div>
  );
}

function FunctionCard({
  id,
  label,
  footer,
  info,
  value,
  color,
  ariaLabel,
  catalog,
  onChange,
}: {
  id: string;
  label: string;
  footer: string;
  info: string;
  value: number;
  color: string | undefined;
  ariaLabel: string;
  catalog?: FunctionCatalog;
  onChange: (value: number) => void;
}) {
  return (
    <div
      className={`param-row play-state-param ctl-pedal has-footer${value === 0 ? " is-dim" : " is-alert"}`}
      style={{ "--play-state-color": color ?? "var(--muted)" } as CSSProperties}
    >
      <div className="param-label">
        <label htmlFor={id}>{label}</label>
        <InfoTip label={label} text={info} />
      </div>
      <CtlFunctionSelect
        id={id}
        value={value}
        ariaLabel={ariaLabel}
        catalog={catalog}
        onChange={onChange}
      />
      <span className="play-state-footer">{footer}</span>
    </div>
  );
}

function ExtCtrlEditor({
  model,
  onPatch,
  scope,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  scope: "mem" | "sys";
}) {
  return (
    <>
      {EXT_JACKS.map((jack) => (
        <section key={jack.title}>
          <h3 className="section-title">{jack.title}</h3>
          {jack.ctls.map((n) => {
            const tags = model.ectlCtl[n - 1] ?? {};
            const patch = (partial: Record<string, string>) =>
              onPatch({ type: "section", section: `ECTL_CTL${n}`, tags: partial, scope });
            return (
              <div key={n} className="ectl-grid" aria-label={`CTL ${n}`}>
                {CTL_GESTURES.map((gesture) => {
                  const value = num(tags, gesture.tag, 0);
                  const selected = ctlFunctionInfo(value);
                  return (
                    <FunctionCard
                      key={gesture.tag}
                      id={`ectl-ctl${n}-${gesture.tag.toLowerCase()}`}
                      label={`CTL ${n}`}
                      footer={gesture.name}
                      info={selected ? `${gesture.info} ${selected}` : gesture.info}
                      value={value}
                      color={ctlFunctionColor(value)}
                      ariaLabel={`CTL ${n} ${gesture.name}`}
                      onChange={(v) => patch({ [gesture.tag]: String(v) })}
                    />
                  );
                })}
              </div>
            );
          })}
          {(() => {
            const n = jack.exp;
            const tags = model.ectlExp[n - 1] ?? {};
            const fn = num(tags, "A", 0);
            const min = num(tags, "C", 0);
            const max = num(tags, "D", 100);
            const patch = (partial: Record<string, string>) =>
              onPatch({ type: "section", section: `ECTL_EXP${n}`, tags: partial, scope });
            const fnInfo =
              expFunctionInfo(fn) ?? "Stored value with no name in the function list.";
            return (
              <div className="ectl-grid" aria-label={`EXP ${n}`}>
                <FunctionCard
                  id={`ectl-exp${n}-a`}
                  label={`EXP ${n}`}
                  footer="Function"
                  info={fnInfo}
                  value={fn}
                  color={EXP_CATALOG.color(fn)}
                  ariaLabel={`EXP ${n} function`}
                  catalog={EXP_CATALOG}
                  onChange={(v) => patch({ A: String(v) })}
                />
                <ScrubCard
                  id={`ectl-exp${n}-c`}
                  def={{
                    tag: "C",
                    name: `EXP ${n} Min`,
                    kind: "int",
                    min: 0,
                    max: 255,
                    info: "Lower end of the expression range. The scale depends on the function.",
                  }}
                  value={min}
                  min={0}
                  max={255}
                  format={(v) => ({ value: String(v) })}
                  alert={min !== 0}
                  onChange={(v) => patch({ C: String(v) })}
                />
                <ScrubCard
                  id={`ectl-exp${n}-d`}
                  def={{
                    tag: "D",
                    name: `EXP ${n} Max`,
                    kind: "int",
                    min: 0,
                    max: 255,
                    info: "Upper end of the expression range. The scale depends on the function.",
                  }}
                  value={max}
                  min={0}
                  max={255}
                  format={(v) => ({ value: String(v) })}
                  alert={max !== 100}
                  onChange={(v) => patch({ D: String(v) })}
                />
              </div>
            );
          })()}
        </section>
      ))}
    </>
  );
}
