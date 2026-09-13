import { useMemo } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  COLOR_PARAMS,
  MIDI_PARAMS,
  SETUP_GROUPS,
  USB_PARAMS,
  USB_STORAGE_CONNECT,
  knobFunctionDef,
} from "@rc600/catalog/params";
import {
  parseSystem,
  systemAsMemoryModel,
  type TagMap,
} from "@rc600/rc0/memory";
import { applyOpsToModel, type PatchOp } from "@rc600/rc0/ops";
import { Icon, type IconName } from "./Icon";
import { ParamControl } from "./ParamControl";
import { InputTab } from "./InputTab";
import { OutputTab } from "./OutputTab";
import { MixerTab } from "./MixerTab";
import { ControlTab } from "./ControlTab";
import type { PatchHandler } from "./LoopTab";

const SYS_TABS = ["input", "output", "mixer", "ctl", "usb", "midi", "setup"] as const;
type SysPrimary = (typeof SYS_TABS)[number];

const PRIMARY: { id: SysPrimary; label: string; icon: IconName }[] = [
  { id: "input", label: "Input", icon: "mic" },
  { id: "output", label: "Output", icon: "master" },
  { id: "mixer", label: "Mixer", icon: "tune" },
  { id: "ctl", label: "Ctl Func", icon: "controls" },
  { id: "usb", label: "USB", icon: "usb" },
  { id: "midi", label: "MIDI", icon: "midi" },
  { id: "setup", label: "Setup", icon: "system" },
];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Apply section ops onto parseSystem's section map for USB/MIDI/SETUP/COLOR/PREF. */
function applySysSectionOps(
  sections: Record<string, TagMap>,
  ops: PatchOp[],
): Record<string, TagMap> {
  const next: Record<string, TagMap> = {};
  for (const [k, v] of Object.entries(sections)) next[k] = { ...v };
  for (const op of ops) {
    if (op.type !== "section" || op.scope !== "sys") continue;
    next[op.section] = { ...(next[op.section] ?? {}), ...op.tags };
  }
  return next;
}

export function SystemTab({
  baseXml,
  ops,
  side,
  onPatch,
}: {
  baseXml: string;
  ops: PatchOp[];
  side: "1" | "2";
  onPatch: PatchHandler;
}) {
  const [primary, setPrimary] = usePersistedTab<SysPrimary>("system", "input", SYS_TABS);
  const baseModel = useMemo(() => systemAsMemoryModel(baseXml), [baseXml]);
  const model = useMemo(() => applyOpsToModel(baseModel, ops), [baseModel, ops]);
  const baseSystem = useMemo(() => parseSystem(baseXml, side), [baseXml, side]);
  const sections = useMemo(
    () => applySysSectionOps(baseSystem.sections, ops),
    [baseSystem.sections, ops],
  );
  const pref = sections.PREF ?? {};
  const setupTags = sections.SETUP ?? {};

  const setPref = (tag: string, value: number) => {
    onPatch({ type: "section", section: "PREF", tags: { [tag]: String(value) }, scope: "sys" });
  };

  const preference = { tags: pref, onChange: setPref };

  return (
    <div className="system-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="System">
        {PRIMARY.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={primary === t.id}
            className={`tab ${primary === t.id ? "active" : ""}`}
            onClick={() => setPrimary(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 0 }}>
        Editing SYSTEM{side}.RC0 (active side by count {baseSystem.count}). Same Input / Output /
        Mixer / Ctl layout as Memory; Preference chooses MEMORY vs SYSTEM on the pedal.
      </p>

      {primary === "input" ? (
        <InputTab model={model} onPatch={onPatch} scope="sys" preference={preference} />
      ) : null}

      {primary === "output" ? (
        <OutputTab model={model} onPatch={onPatch} scope="sys" preference={preference} />
      ) : null}

      {primary === "mixer" ? <MixerTab model={model} onPatch={onPatch} scope="sys" /> : null}

      {primary === "ctl" ? (
        <ControlTab model={model} onPatch={onPatch} scope="sys" preference={preference} />
      ) : null}

      {primary === "usb" ? (
        <>
          <h3 className="section-title">USB</h3>
          <p className="hint">
            Storage stays Connect and locked here — the editor only reaches the ROLAND folder while
            USB Storage is connected.
          </p>
          <div className="param-columns">
            {USB_PARAMS.map((def) => {
              const storageLocked = def.tag === "A";
              return (
                <ParamControl
                  key={def.tag}
                  id={`usb-${def.tag}`}
                  def={def}
                  value={
                    storageLocked
                      ? USB_STORAGE_CONNECT
                      : num(sections.USB ?? {}, def.tag, def.default ?? 0)
                  }
                  disabled={storageLocked}
                  onChange={(v) => {
                    if (storageLocked) return;
                    onPatch({
                      type: "section",
                      section: "USB",
                      tags: { [def.tag]: String(v) },
                      scope: "sys",
                    });
                  }}
                />
              );
            })}
          </div>
        </>
      ) : null}

      {primary === "midi" ? (
        <>
          <h3 className="section-title">MIDI</h3>
          <div className="param-columns">
            {MIDI_PARAMS.map((def) => (
              <ParamControl
                key={def.tag}
                id={`midi-${def.tag}`}
                def={def}
                value={num(sections.MIDI ?? {}, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({
                    type: "section",
                    section: "MIDI",
                    tags: { [def.tag]: String(v) },
                    scope: "sys",
                  })
                }
              />
            ))}
          </div>
        </>
      ) : null}

      {primary === "setup" ? (
        <>
          <p className="hint">System SETUP and LOOP STATUS COLOR (Parameter Guide).</p>
          <div className="channel-grid">
            {SETUP_GROUPS.filter((g) => g.title !== "Knob Func").map((group) => (
              <section key={group.title} className="channel-card">
                <h3 className="section-title">{group.title}</h3>
                <div className="param-columns">
                  {group.params.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`setup-${def.tag}`}
                      def={def}
                      value={num(setupTags, def.tag, def.default ?? 0)}
                      onChange={(v) =>
                        onPatch({
                          type: "section",
                          section: "SETUP",
                          tags: { [def.tag]: String(v) },
                          scope: "sys",
                        })
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
            <section className="channel-card">
              <h3 className="section-title">Color</h3>
              <div className="param-columns">
                {COLOR_PARAMS.map((def) => (
                  <ParamControl
                    key={def.tag}
                    id={`color-${def.tag}`}
                    def={def}
                    value={num(sections.COLOR ?? {}, def.tag, def.default ?? 0)}
                    onChange={(v) =>
                      onPatch({
                        type: "section",
                        section: "COLOR",
                        tags: { [def.tag]: String(v) },
                        scope: "sys",
                      })
                    }
                  />
                ))}
              </div>
            </section>
          </div>
          <h3 className="section-title">Knob Func</h3>
          <p className="hint">Functions of the [1]–[4] knobs on the play screen.</p>
          <div className="param-columns">
            {(SETUP_GROUPS.find((g) => g.title === "Knob Func")?.params ?? []).map((def) => {
              const raw = num(setupTags, def.tag, def.default ?? 0);
              return (
                <ParamControl
                  key={def.tag}
                  id={`setup-${def.tag}`}
                  def={knobFunctionDef(def.tag, def.name, raw)}
                  value={raw}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: "SETUP",
                      tags: { [def.tag]: String(v) },
                      scope: "sys",
                    })
                  }
                />
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
