import { useMemo, type CSSProperties } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  COLOR_PARAMS,
  MIDI_PARAMS,
  SETUP_GROUPS,
  USB_PARAMS,
  USB_STORAGE_CONNECT,
  knobFunctionInfo,
  knobFunctionLabel,
} from "@rc600/catalog/params";
import {
  parseSystem,
  systemAsMemoryModel,
  type TagMap,
} from "@rc600/rc0/memory";
import { applyOpsToModel, type PatchOp } from "@rc600/rc0/ops";
import { CtlFunctionSelect, KNOB_CATALOG } from "./CtlFunctionSelect";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { ParamControl } from "./ParamControl";
import { InputTab } from "./InputTab";
import { OutputTab } from "./OutputTab";
import { MixerTab } from "./MixerTab";
import { ControlTab } from "./ControlTab";
import {
  ScrubCard,
  TrackStateCard,
  onOffView,
  type PatchHandler,
  type TrackStateView,
} from "./LoopTab";

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

const USB_VIEWS: Record<string, TrackStateView> = {
  A: {
    label: "Storage",
    variant: "usb-storage",
    states: [
      {
        icon: "disconnect",
        text: "Off",
        title: "USB Storage is off. The editor cannot reach the ROLAND folder.",
        color: "var(--muted)",
        dim: true,
      },
      {
        icon: "usb",
        text: "Connect",
        title: "USB Storage is connected. It stays on Connect while this editor is using the folder.",
        alert: true,
      },
    ],
  },
  B: {
    label: "Audio Mode",
    variant: "usb-audio",
    states: [
      { icon: "usb", text: "Generic", title: "USB audio uses the operating system driver." },
      {
        icon: "midi",
        text: "Vendor",
        title: "USB audio uses the BOSS driver from boss.info/support.",
        color: "#c084fc",
        alert: true,
      },
    ],
  },
  C: {
    label: "Routing",
    variant: "usb-route",
    states: [
      { icon: "speaker", text: "Line Out", title: "Audio from the computer goes to the line output." },
      {
        icon: "tune",
        text: "Sub Mix",
        title: "Audio from the computer is mixed into the sub mix.",
        color: "#c084fc",
        alert: true,
      },
      {
        icon: "loop",
        text: "Loop In",
        title: "Audio from the computer can be recorded into tracks.",
        color: "#a3e635",
        alert: true,
      },
    ],
  },
};

const USB_LEVEL_TAGS = new Set(["D", "E"]);

const MIDI_CHANNEL_ICON: Record<string, IconName> = {
  A: "controls",
  C: "tempo",
  D: "mic",
  E: "upload",
};

const MIDI_VIEWS: Record<string, TrackStateView> = {
  F: {
    label: "Sync Clock",
    variant: "midi-clock",
    states: [
      { icon: "tempo", text: "Auto", title: "Tempo follows MIDI, then USB, then the internal clock." },
      {
        icon: "system",
        text: "Internal",
        title: "Tempo uses the RC-600 clock.",
        color: "#facc15",
        alert: true,
      },
      {
        icon: "midi",
        text: "MIDI",
        title: "Tempo follows MIDI clock.",
        color: "#c084fc",
        alert: true,
      },
      {
        icon: "usb",
        text: "USB (Auto)",
        title: "Tempo follows USB, then the internal clock.",
        color: "#38bdf8",
        alert: true,
      },
    ],
  },
  G: onOffView(
    "Clock Out",
    "midi",
    "The RC-600 does not transmit MIDI clock.",
    "The RC-600 transmits MIDI clock.",
  ),
  H: {
    label: "Start",
    variant: "midi-start",
    states: [
      {
        icon: "notesOff",
        text: "Off",
        title: "A MIDI Start message does not start playback.",
        color: "var(--muted)",
        dim: true,
      },
      { icon: "playMulti", text: "All", title: "A MIDI Start message starts the tracks and the rhythm." },
      {
        icon: "tempo",
        text: "Rhythm",
        title: "A MIDI Start message starts the rhythm only.",
        color: "#c084fc",
        alert: true,
      },
    ],
  },
  I: onOffView(
    "PC Out",
    "scene",
    "Switching memories does not send a Program Change.",
    "Switching memories sends a Program Change.",
  ),
  J: midiThruView("Thru MIDI In", "MIDI IN"),
  K: midiThruView("Thru USB In", "the USB port"),
};

function midiThruView(label: string, source: string): TrackStateView {
  return {
    label,
    variant: "midi-thru",
    states: [
      {
        icon: "disconnect",
        text: "Off",
        title: `Messages received at ${source} are not forwarded.`,
        color: "var(--muted)",
        dim: true,
      },
      {
        icon: "midi",
        text: "MIDI Out",
        title: `Messages received at ${source} are sent to MIDI OUT.`,
        color: "#c084fc",
        alert: true,
      },
      {
        icon: "usb",
        text: "USB Out",
        title: `Messages received at ${source} are sent to the USB port.`,
        color: "#38bdf8",
        alert: true,
      },
      {
        icon: "connect",
        text: "USB & MIDI",
        title: `Messages received at ${source} are sent to MIDI OUT and the USB port.`,
        color: "#a3e635",
        alert: true,
      },
    ],
  };
}

function midiChannelText(tag: string, value: number): { value: string; unit?: string } {
  if (tag === "E" && value === 17) return { value: "Rx", unit: "CTL" };
  return { value: String(value) };
}

const DISPLAY_MODE_VIEW: TrackStateView = {
  label: "Display Mode",
  variant: "display-mode",
  states: [
    { icon: "scene", text: "Memory Number", title: "The play screen shows the memory number." },
    {
      icon: "play",
      text: "Track Status",
      title: "The play screen shows track status.",
      color: "#34d399",
      alert: true,
    },
    {
      icon: "loop",
      text: "Loop Tracks",
      title: "The play screen shows the loop tracks.",
      color: "#a3e635",
      alert: true,
    },
    {
      icon: "live",
      text: "Loop Status",
      title: "The play screen shows loop status.",
      color: "#22d3ee",
      alert: true,
    },
    {
      icon: "master",
      text: "Loop Level",
      title: "The play screen shows loop level.",
      color: "#f59e0b",
      alert: true,
    },
    {
      icon: "mfx",
      text: "Input FX",
      title: "The play screen shows Input FX.",
      color: "#22d3ee",
      alert: true,
    },
    {
      icon: "tune",
      text: "Track FX",
      title: "The play screen shows Track FX.",
      color: "#fb923c",
      alert: true,
    },
  ],
};

function indicatorView(label: string, ring: string): TrackStateView {
  return {
    label,
    variant: "indicator",
    states: [
      { icon: "loop", text: "Loop", title: `The ${ring} shows the loop.` },
      {
        icon: "recordPlayer",
        text: "Rhythm",
        title: `The ${ring} shows the rhythm.`,
        color: "#f472b6",
        alert: true,
      },
      {
        icon: "note",
        text: "Beat",
        title: `The ${ring} shows the beat.`,
        color: "#a3e635",
        alert: true,
      },
      {
        icon: "tempo",
        text: "Tempo",
        title: `The ${ring} shows the tempo.`,
        color: "#f59e0b",
        alert: true,
      },
    ],
  };
}

const LOOP_COLOR_VIEW: TrackStateView = {
  label: "Color",
  variant: "loop-color",
  states: [
    {
      icon: "notesOff",
      text: "Off",
      title: "The indicator stays off.",
      color: "var(--muted)",
      dim: true,
    },
    { icon: "live", text: "Red", title: "Red.", color: "#ef4444", alert: true },
    { icon: "live", text: "Green", title: "Green.", color: "#22c55e", alert: true },
    { icon: "live", text: "Amber", title: "Amber.", color: "#f59e0b", alert: true },
    { icon: "live", text: "Blue", title: "Blue.", color: "#3b82f6", alert: true },
    { icon: "live", text: "Purple", title: "Purple.", color: "#a855f7", alert: true },
    { icon: "live", text: "Cyan", title: "Cyan.", color: "#22d3ee", alert: true },
    { icon: "live", text: "White", title: "White.", color: "#f8fafc", alert: true },
  ],
};

function colorView(label: string): TrackStateView {
  return { ...LOOP_COLOR_VIEW, label };
}

function setupParam(title: string, tag: string) {
  const def = SETUP_GROUPS.find((group) => group.title === title)?.params.find((param) => param.tag === tag);
  if (!def) throw new Error(`Missing SETUP ${title} ${tag}`);
  return def;
}

const SETUP_CONTRAST = setupParam("Display", "I");
const SETUP_DISPLAY = setupParam("Display", "B");
const SETUP_LOOP_IND = setupParam("Indicators", "D");
const SETUP_ORB_IND = setupParam("Indicators", "E");
const SETUP_AUTO_OFF = setupParam("Power", "H");
const SETUP_MEM_MIN = setupParam("Memory Ext", "A");
const SETUP_MEM_MAX = setupParam("Memory Ext", "C");
const SETUP_KNOBS = SETUP_GROUPS.find((group) => group.title === "Knob Func")?.params ?? [];

function KnobFuncCard({
  id,
  name,
  value,
  onChange,
}: {
  id: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const color = KNOB_CATALOG.color(value);
  return (
    <div
      className={`param-row play-state-param ctl-pedal${value === 0 ? " is-dim" : " is-alert"}`}
      style={{ "--play-state-color": color ?? "var(--muted)" } as CSSProperties}
    >
      <div className="param-label">
        <label htmlFor={id}>{name}</label>
        <InfoTip label={name} text={knobFunctionInfo(value) ?? "No function is assigned."} />
      </div>
      <CtlFunctionSelect
        id={id}
        value={value}
        ariaLabel={`${name}: ${knobFunctionLabel(value)}`}
        catalog={KNOB_CATALOG}
        onChange={onChange}
      />
    </div>
  );
}

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

  const setSetup = (tag: string, value: number) => {
    onPatch({ type: "section", section: "SETUP", tags: { [tag]: String(value) }, scope: "sys" });
  };
  const setColor = (tag: string, value: number) => {
    onPatch({ type: "section", section: "COLOR", tags: { [tag]: String(value) }, scope: "sys" });
  };

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
        <span className="tabs-help">
          <InfoTip
            label="System"
            text={`Editing SYSTEM${side}.RC0 (active side by count ${baseSystem.count}). Same Input / Output / Mixer / Ctl layout as Memory; Preference chooses MEMORY vs SYSTEM on the pedal.`}
          />
        </span>
      </div>

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
          <div className="meter-columns">
            {USB_PARAMS.filter((def) => USB_LEVEL_TAGS.has(def.tag)).map((def) => (
              <ParamControl
                key={def.tag}
                id={`usb-${def.tag}`}
                def={def}
                value={num(sections.USB ?? {}, def.tag, def.default ?? 0)}
                onChange={(v) =>
                  onPatch({
                    type: "section",
                    section: "USB",
                    tags: { [def.tag]: String(v) },
                    scope: "sys",
                  })
                }
              />
            ))}
          </div>
          <div className="track-state-cards" aria-label="USB">
            {USB_PARAMS.filter((def) => USB_VIEWS[def.tag]).map((def) => {
              const storageLocked = def.tag === "A";
              return (
                <TrackStateCard
                  key={def.tag}
                  id={`usb-${def.tag}`}
                  def={def}
                  view={USB_VIEWS[def.tag]!}
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
          <div className="track-state-cards" aria-label="MIDI channels">
            {MIDI_PARAMS.filter((def) => def.tag in MIDI_CHANNEL_ICON).map((def) => {
              const value = num(sections.MIDI ?? {}, def.tag, def.default ?? 0);
              const max = def.tag === "E" ? 17 : 16;
              return (
                <ScrubCard
                  key={def.tag}
                  id={`midi-${def.tag}`}
                  def={def}
                  value={value}
                  min={1}
                  max={max}
                  valueIcon={MIDI_CHANNEL_ICON[def.tag]}
                  alert={value !== (def.default ?? 0)}
                  format={(v) => midiChannelText(def.tag, v)}
                  onChange={(v) =>
                    onPatch({
                      type: "section",
                      section: "MIDI",
                      tags: { [def.tag]: String(v) },
                      scope: "sys",
                    })
                  }
                />
              );
            })}
          </div>
          <div className="track-state-cards" aria-label="MIDI">
            {MIDI_PARAMS.filter((def) => MIDI_VIEWS[def.tag]).map((def) => (
              <TrackStateCard
                key={def.tag}
                id={`midi-${def.tag}`}
                def={def}
                view={MIDI_VIEWS[def.tag]!}
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
          <h3 className="section-title">Display</h3>
          <div className="track-state-cards" aria-label="Display">
            <ScrubCard
              id="setup-I"
              def={SETUP_CONTRAST}
              value={num(setupTags, SETUP_CONTRAST.tag, SETUP_CONTRAST.default ?? 6)}
              min={SETUP_CONTRAST.min ?? 1}
              max={SETUP_CONTRAST.max ?? 10}
              valueIcon="tune"
              alert={num(setupTags, SETUP_CONTRAST.tag, SETUP_CONTRAST.default ?? 6) !== (SETUP_CONTRAST.default ?? 6)}
              format={(v) => ({ value: String(v) })}
              onChange={(v) => setSetup(SETUP_CONTRAST.tag, v)}
            />
            <TrackStateCard
              id="setup-B"
              def={SETUP_DISPLAY}
              view={DISPLAY_MODE_VIEW}
              value={num(setupTags, SETUP_DISPLAY.tag, SETUP_DISPLAY.default ?? 0)}
              onChange={(v) => setSetup(SETUP_DISPLAY.tag, v)}
            />
          </div>

          <h3 className="section-title">Indicators</h3>
          <div className="track-state-cards" aria-label="Indicators">
            <TrackStateCard
              id="setup-D"
              def={SETUP_LOOP_IND}
              view={indicatorView("Loop Indicator", "outer ring")}
              value={num(setupTags, SETUP_LOOP_IND.tag, SETUP_LOOP_IND.default ?? 0)}
              onChange={(v) => setSetup(SETUP_LOOP_IND.tag, v)}
            />
            <TrackStateCard
              id="setup-E"
              def={SETUP_ORB_IND}
              view={indicatorView("Orb Indicator", "center ring")}
              value={num(setupTags, SETUP_ORB_IND.tag, SETUP_ORB_IND.default ?? 0)}
              onChange={(v) => setSetup(SETUP_ORB_IND.tag, v)}
            />
          </div>

          <h3 className="section-title">Power</h3>
          <div className="track-state-cards" aria-label="Power">
            <TrackStateCard
              id="setup-H"
              def={SETUP_AUTO_OFF}
              view={onOffView(
                "Auto Off",
                "power",
                "Power stays on.",
                "Power turns off after 10 hours with no play or operation.",
              )}
              value={num(setupTags, SETUP_AUTO_OFF.tag, SETUP_AUTO_OFF.default ?? 1)}
              onChange={(v) => setSetup(SETUP_AUTO_OFF.tag, v)}
            />
          </div>

          <h3 className="section-title">Memory Ext</h3>
          <div className="track-state-cards" aria-label="Memory Ext">
            <ScrubCard
              id="setup-A"
              def={SETUP_MEM_MIN}
              value={num(setupTags, SETUP_MEM_MIN.tag, SETUP_MEM_MIN.default ?? 1)}
              min={SETUP_MEM_MIN.min ?? 1}
              max={SETUP_MEM_MIN.max ?? 99}
              valueIcon="scene"
              alert={num(setupTags, SETUP_MEM_MIN.tag, SETUP_MEM_MIN.default ?? 1) !== (SETUP_MEM_MIN.default ?? 1)}
              format={(v) => ({ value: String(v) })}
              onChange={(v) => setSetup(SETUP_MEM_MIN.tag, v)}
            />
            <ScrubCard
              id="setup-C"
              def={SETUP_MEM_MAX}
              value={num(setupTags, SETUP_MEM_MAX.tag, SETUP_MEM_MAX.default ?? 99)}
              min={SETUP_MEM_MAX.min ?? 1}
              max={SETUP_MEM_MAX.max ?? 99}
              valueIcon="scene"
              alert={num(setupTags, SETUP_MEM_MAX.tag, SETUP_MEM_MAX.default ?? 99) !== (SETUP_MEM_MAX.default ?? 99)}
              format={(v) => ({ value: String(v) })}
              onChange={(v) => setSetup(SETUP_MEM_MAX.tag, v)}
            />
          </div>

          <h3 className="section-title">Color</h3>
          <div className="track-state-cards" aria-label="Color">
            {COLOR_PARAMS.map((def) => (
              <TrackStateCard
                key={def.tag}
                id={`color-${def.tag}`}
                def={def}
                view={colorView(def.name)}
                value={num(sections.COLOR ?? {}, def.tag, def.default ?? 0)}
                onChange={(v) => setColor(def.tag, v)}
              />
            ))}
          </div>

          <h3 className="section-title">
            Knob Func
            <InfoTip label="Knob Func" text="Functions of the [1]–[4] knobs on the play screen." />
          </h3>
          <div className="track-state-cards" aria-label="Knob Func">
            {SETUP_KNOBS.map((def) => (
              <KnobFuncCard
                key={def.tag}
                id={`setup-${def.tag}`}
                name={def.name}
                value={num(setupTags, def.tag, def.default ?? 0)}
                onChange={(v) => setSetup(def.tag, v)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
