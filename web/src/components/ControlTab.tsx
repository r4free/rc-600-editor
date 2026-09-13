import { usePersistedTab } from "../uiTabs";
import {
  ctlFunctionDef,
  expFunctionDef,
  PREF_CTL_GROUP,
  PREF_ALL_CLEAR,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import { Icon, type IconName } from "./Icon";
import type { PatchHandler } from "./LoopTab";
import { ParamControl } from "./ParamControl";

const CTL_SUBS_WITH_PREF = ["mode1", "mode2", "mode3", "ext", "pref"] as const;
type CtlSub = (typeof CTL_SUBS_WITH_PREF)[number];

const SUBS: { id: CtlSub; label: string; icon: IconName }[] = [
  { id: "mode1", label: "Mode 1", icon: "controls" },
  { id: "mode2", label: "Mode 2", icon: "controls" },
  { id: "mode3", label: "Mode 3", icon: "controls" },
  { id: "ext", label: "Ext Ctrl", icon: "external" },
];

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
      </div>

      {visibleSub === "pref" && preference ? (
        <>
          <p className="hint">
            MEMORY uses the Ctl Func settings stored in each memory. SYSTEM uses these global
            defaults.
          </p>
          <h3 className="section-title">{PREF_CTL_GROUP.title}</h3>
          <div className="param-columns">
            {PREF_CTL_GROUP.params.map((def) => (
              <ParamControl
                key={def.tag}
                id={`ctl-pref-${def.tag}`}
                def={def}
                value={num(preference.tags, def.tag, def.default ?? 0)}
                onChange={(v) => preference.onChange(def.tag, v)}
              />
            ))}
            <ParamControl
              id="ctl-pref-allclear"
              def={PREF_ALL_CLEAR}
              value={num(preference.tags, PREF_ALL_CLEAR.tag, PREF_ALL_CLEAR.default ?? 0)}
              onChange={(v) => preference.onChange(PREF_ALL_CLEAR.tag, v)}
            />
          </div>
        </>
      ) : null}

      {modeNo ? (
        <>
          <p className="hint">
            Function of the nine onboard switches in pedal mode {modeNo}.
            {preference
              ? ""
              : " MEMORY vs SYSTEM preference lives in System → Ctl Func → Preference."}
          </p>
          <div className="param-columns">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pedal) => {
              const tags = model.ctlPedals[modeNo - 1]?.[pedal - 1] ?? {};
              const value = num(tags, "A", 0);
              return (
                <ParamControl
                  key={pedal}
                  id={`ictl-${modeNo}-p${pedal}-a`}
                  def={ctlFunctionDef("A", `Pedal ${pedal}`, value)}
                  value={value}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: `ICTL${modeNo}_PEDAL${pedal}`,
                      tags: patchPedalFunction(tags, v),
                      scope,
                    })
                  }
                />
              );
            })}
          </div>
        </>
      ) : null}

      {visibleSub === "ext" ? (
        <ExtCtrlEditor model={model} onPatch={onPatch} scope={scope} system={Boolean(preference)} />
      ) : null}
    </div>
  );
}

function ExtCtrlEditor({
  model,
  onPatch,
  scope,
  system,
}: {
  model: MemoryModel;
  onPatch: PatchHandler;
  scope: "mem" | "sys";
  system?: boolean;
}) {
  return (
    <>
      <p className="hint">
        Footswitches and expression pedals on CTL 1, 2 / EXP 1 and CTL 3, 4 / EXP 2. Push, hold,
        and double-click can each take a CTL FUNC.
        {system ? "" : " MEMORY vs SYSTEM preference lives in System → Ctl Func → Preference."}
      </p>
      {[1, 2, 3, 4].map((n) => {
        const tags = model.ectlCtl[n - 1] ?? {};
        const push = num(tags, "A", 0);
        const hold = num(tags, "B", 0);
        const click = num(tags, "C", 0);
        const patch = (partial: Record<string, string>) =>
          onPatch({ type: "section", section: `ECTL_CTL${n}`, tags: partial, scope });
        return (
          <section key={n}>
            <h3 className="section-title">CTL {n}</h3>
            <div className="param-columns">
              <ParamControl
                id={`ectl-ctl${n}-a`}
                def={ctlFunctionDef("A", "Push", push, "Functions when the switch is pressed.")}
                value={push}
                onChange={(v) => patch({ A: String(v) })}
              />
              <ParamControl
                id={`ectl-ctl${n}-b`}
                def={ctlFunctionDef("B", "Hold", hold, "Functions when the switch is held down.")}
                value={hold}
                onChange={(v) => patch({ B: String(v) })}
              />
              <ParamControl
                id={`ectl-ctl${n}-c`}
                def={ctlFunctionDef(
                  "C",
                  "Click",
                  click,
                  "Functions when the switch is double-clicked.",
                )}
                value={click}
                onChange={(v) => patch({ C: String(v) })}
              />
            </div>
          </section>
        );
      })}
      {[1, 2].map((n) => {
        const tags = model.ectlExp[n - 1] ?? {};
        const fn = num(tags, "A", 0);
        const min = num(tags, "C", 0);
        const max = num(tags, "D", 100);
        const patch = (partial: Record<string, string>) =>
          onPatch({ type: "section", section: `ECTL_EXP${n}`, tags: partial, scope });
        return (
          <section key={n}>
            <h3 className="section-title">EXP {n}</h3>
            <div className="param-columns">
              <ParamControl
                id={`ectl-exp${n}-a`}
                def={expFunctionDef("A", "Function", fn)}
                value={fn}
                onChange={(v) => patch({ A: String(v) })}
              />
              <ParamControl
                id={`ectl-exp${n}-c`}
                def={{
                  tag: "C",
                  name: "Min",
                  kind: "int",
                  min: 0,
                  max: 255,
                  info: "Lower end of the expression range. The scale depends on the function.",
                }}
                value={min}
                onChange={(v) => patch({ C: String(v) })}
              />
              <ParamControl
                id={`ectl-exp${n}-d`}
                def={{
                  tag: "D",
                  name: "Max",
                  kind: "int",
                  min: 0,
                  max: 255,
                  info: "Upper end of the expression range. The scale depends on the function.",
                }}
                value={max}
                onChange={(v) => patch({ D: String(v) })}
              />
            </div>
          </section>
        );
      })}
    </>
  );
}
