import { useMemo, useState } from "react";
import {
  COLOR_PARAMS,
  MIDI_PARAMS,
  SETUP_GROUPS,
  SETUP_MAPPED_TAGS,
  USB_PARAMS,
  USB_STORAGE_CONNECT,
  knobFunctionDef,
} from "@rc600/catalog/params";
import {
  parseSystem,
  patchSysSection,
  systemAsMemoryModel,
  type TagMap,
} from "@rc600/rc0/memory";
import { Icon, type IconName } from "./Icon";
import { ParamControl, TagMapEditor } from "./ParamControl";
import { InputTab } from "./InputTab";
import { OutputTab } from "./OutputTab";
import { MixerTab } from "./MixerTab";
import { ControlTab } from "./ControlTab";

type SysPrimary =
  | "input"
  | "output"
  | "mixer"
  | "ctl"
  | "usb"
  | "midi"
  | "setup";

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

export function SystemTab({
  xml,
  side,
  onXml,
}: {
  xml: string;
  side: "1" | "2";
  onXml: (next: string) => void;
}) {
  const [primary, setPrimary] = useState<SysPrimary>("input");
  const model = useMemo(() => systemAsMemoryModel(xml), [xml]);
  const system = useMemo(() => parseSystem(xml, side), [xml, side]);
  const pref = system.sections.PREF ?? {};

  const setPref = (tag: string, value: number) => {
    onXml(patchSysSection(xml, "PREF", { [tag]: String(value) }));
  };

  const preference = { tags: pref, onChange: setPref };

  const setupTags = system.sections.SETUP ?? {};
  const setupOther = Object.fromEntries(
    Object.entries(setupTags).filter(([tag]) => !SETUP_MAPPED_TAGS.has(tag)),
  );

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
        Editing SYSTEM{side}.RC0 (active side by count {system.count}). Same Input / Output / Mixer /
        Ctl layout as Memory; Preference chooses MEMORY vs SYSTEM on the pedal.
      </p>

      {primary === "input" ? (
        <InputTab
          model={model}
          xml={xml}
          onXml={onXml}
          patchSection={patchSysSection}
          preference={preference}
        />
      ) : null}

      {primary === "output" ? (
        <OutputTab
          model={model}
          xml={xml}
          onXml={onXml}
          patchSection={patchSysSection}
          preference={preference}
        />
      ) : null}

      {primary === "mixer" ? (
        <MixerTab model={model} xml={xml} onXml={onXml} patchSection={patchSysSection} />
      ) : null}

      {primary === "ctl" ? (
        <ControlTab
          model={model}
          xml={xml}
          onXml={onXml}
          patchSection={patchSysSection}
          preference={preference}
        />
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
                      : num(system.sections.USB ?? {}, def.tag, def.default ?? 0)
                  }
                  disabled={storageLocked}
                  onChange={(v) => {
                    if (storageLocked) return;
                    onXml(patchSysSection(xml, "USB", { [def.tag]: String(v) }));
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
                value={num(system.sections.MIDI ?? {}, def.tag, def.default ?? 0)}
                onChange={(v) => onXml(patchSysSection(xml, "MIDI", { [def.tag]: String(v) }))}
              />
            ))}
          </div>
        </>
      ) : null}

      {primary === "setup" ? (
        <>
          <p className="hint">
            System SETUP and LOOP STATUS COLOR (Parameter Guide). Unmapped SETUP tags stay editable
            below until FX Knob Mode and related fields are confirmed in RC0.
          </p>
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
                        onXml(patchSysSection(xml, "SETUP", { [def.tag]: String(v) }))
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
                    value={num(system.sections.COLOR ?? {}, def.tag, def.default ?? 0)}
                    onChange={(v) =>
                      onXml(patchSysSection(xml, "COLOR", { [def.tag]: String(v) }))
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
                    onXml(patchSysSection(xml, "SETUP", { [def.tag]: String(v) }))
                  }
                />
              );
            })}
          </div>
          {Object.keys(setupOther).length > 0 ? (
            <>
              <h3 className="section-title">Other SETUP tags</h3>
              <p className="hint">
                Tags F, G, J, O–V (and any extras) are still present in SYSTEM*.RC0 but not fully
                mapped yet — edit raw values so nothing is lost.
              </p>
              <TagMapEditor
                tags={setupOther}
                onChange={(tag, value) => onXml(patchSysSection(xml, "SETUP", { [tag]: value }))}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
