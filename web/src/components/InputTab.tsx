import {
  INPUT_DYNAMICS_GROUPS,
  INPUT_EQ_CHANNELS,
  INPUT_EQ_PARAMS,
  INPUT_EQ_SECTIONS,
  INPUT_MIC_DYNAMICS_LINK,
  INPUT_SETUP_GROUPS,
  PREF_INPUT_GROUP,
  mixerCopyForInputLink,
  type InputEqSection,
  inputEqChannelLabel,
  inputEqLinkPartner,
  inputStereoLinked,
  visibleInputEqChannels,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { EqPanel } from "./EqPanel";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { TrackStateCard, type PatchHandler, type TrackStateView } from "./LoopTab";
import { ParamControl, type MeterStyle } from "./ParamControl";
import { usePersistedTab } from "../uiTabs";

const INPUT_SUBS = ["setup", "eq", "dynamics"] as const;
type InputSub = (typeof INPUT_SUBS)[number];
const SUBS: { id: InputSub; label: string; icon: IconName }[] = [
  { id: "setup", label: "Setup", icon: "system" },
  { id: "eq", label: "EQ", icon: "equalizer" },
  { id: "dynamics", label: "Dynamics", icon: "mfx" },
];

function phantomView(label: string): TrackStateView {
  return {
    label,
    variant: "phantom",
    states: [
      { icon: "phantomOff", text: "Off", title: `${label}: phantom power off.`, color: "var(--muted)", dim: true },
      {
        icon: "phantom",
        text: "+48V",
        title: `${label}: phantom power on. Only for condenser mics that need it.`,
        color: "var(--warn)",
        alert: true,
      },
    ],
  };
}

function gainView(label: string): TrackStateView {
  return {
    label,
    variant: "gain",
    states: [
      { icon: "guitar", text: "INST", title: `${label}: instrument level (guitar, bass, keyboard).` },
      {
        icon: "piano",
        text: "LINE",
        title: `${label}: line level (players, mixers).`,
        color: "#c084fc",
        alert: true,
      },
    ],
  };
}

export function linkView(label: string, pair: string): TrackStateView {
  return {
    label,
    variant: "stereo-link",
    states: [
      { icon: "disconnect", text: "Off", title: `${pair} use separate settings.`, color: "var(--muted)", dim: true },
      { icon: "connect", text: "Linked", title: `${pair} share the same settings.`, alert: true },
    ],
  };
}

const INPUT_SETUP_VIEWS: Record<string, TrackStateView> = {
  A: phantomView("MIC 1"),
  B: phantomView("MIC 2"),
  C: gainView("INST 1"),
  D: gainView("INST 2"),
  E: linkView("MIC", "MIC 1 and MIC 2"),
  F: linkView("INST 1", "INST 1 L and R"),
  G: linkView("INST 2", "INST 2 L and R"),
};

export function preferenceView(label: string): TrackStateView {
  return {
    label,
    variant: "preference",
    states: [
      { icon: "scene", text: "Memory", title: `${label} uses the settings stored in each memory.` },
      {
        icon: "system",
        text: "System",
        title: `${label} uses the global SYSTEM settings.`,
        color: "#c084fc",
        alert: true,
      },
    ],
  };
}

/** Green at light settings, warming to orange as the effect gets heavier (0–100). */
export function depthColor(v: number): string {
  const p = Math.max(0, Math.min(1, v / 100));
  return `hsl(${150 - p * 125} 68% ${40 + p * 12}%)`;
}

const COMP_METER: MeterStyle = { caption: "Compressor", color: depthColor, valueIcon: "compressor" };
const NS_METER: MeterStyle = { caption: "Noise Suppressor", color: depthColor, valueIcon: "noiseGate" };

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function InputTab({
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
  const [sub, setSub] = usePersistedTab<InputSub>(`input.${scope}`, "setup", INPUT_SUBS);
  const [eqCh, setEqCh] = usePersistedTab<InputEqSection>(
    `inputEq.${scope}`,
    "EQ_MIC1",
    INPUT_EQ_SECTIONS,
  );
  const eqChannels = visibleInputEqChannels(model.input);
  const eqSection = eqChannels.some((c) => c.section === eqCh) ? eqCh : eqChannels[0]?.section ?? "EQ_MIC1";
  const eqTags = model.eq[eqSection] ?? {};

  const sectionOp = (section: string, tags: TagMap): PatchOp => ({
    type: "section",
    section,
    tags,
    scope,
  });

  const patchInput = (partial: TagMap) => onPatch(sectionOp("INPUT", partial));

  function setSetup(tag: string, value: number) {
    const partial: TagMap = { [tag]: String(value) };
    if ((tag === "E" || tag === "F" || tag === "G") && value) {
      const primary = INPUT_EQ_CHANNELS.find((c) => c.linkTag === tag && c.role === "primary");
      const secondary = INPUT_EQ_CHANNELS.find((c) => c.linkTag === tag && c.role === "secondary");
      if (tag === "E") {
        for (const [from, to] of INPUT_MIC_DYNAMICS_LINK) {
          partial[to] = String(num(model.input, from));
        }
      }
      const ops: PatchOp[] = [sectionOp("INPUT", partial)];
      if (primary && secondary) {
        ops.push(sectionOp(secondary.section, model.eq[primary.section] ?? {}));
      }
      ops.push(sectionOp("MIXER", mixerCopyForInputLink(model.mixer, tag)));
      onPatch(ops);
      return;
    }
    patchInput(partial);
  }

  function setEq(tag: string, value: number) {
    const partial = { [tag]: String(value) };
    const ops: PatchOp[] = [sectionOp(eqSection, partial)];
    const partner = inputEqLinkPartner(eqSection);
    const ch = INPUT_EQ_CHANNELS.find((c) => c.section === eqSection);
    if (partner && ch && inputStereoLinked(model.input, ch.linkTag)) {
      ops.push(sectionOp(partner, partial));
    }
    onPatch(ops);
  }

  function setDynamics(tag: string, value: number) {
    const partial: TagMap = { [tag]: String(value) };
    if (inputStereoLinked(model.input, "E")) {
      const pair = INPUT_MIC_DYNAMICS_LINK.find(([a, b]) => a === tag || b === tag);
      if (pair) {
        partial[pair[0]] = String(value);
        partial[pair[1]] = String(value);
      }
    }
    patchInput(partial);
  }

  return (
    <div className="input-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="Input">
        {SUBS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={sub === t.id}
            className={`tab ${sub === t.id ? "active" : ""}`}
            onClick={() => setSub(t.id)}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
        {sub === "setup" ? (
          <span className="tabs-help">
            <InfoTip
              label="Input Setup"
              text={
                preference
                  ? "System input defaults. Preference chooses whether each jack uses MEMORY or SYSTEM settings on the pedal."
                  : "Phantom power, INST gain, stereo link, EQ, and dynamics are stored in this memory. MEMORY vs SYSTEM preference lives in System → Input → Setup."
              }
            />
          </span>
        ) : null}
      </div>

      {sub === "setup" ? (
        <>
          <div className="setup-columns">
            {INPUT_SETUP_GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="section-title">{group.title}</h3>
                <div className="track-state-cards">
                  {group.params.map((def) => (
                    <TrackStateCard
                      key={def.tag}
                      id={`in-setup-${def.tag}`}
                      def={def}
                      view={INPUT_SETUP_VIEWS[def.tag]}
                      value={num(model.input, def.tag, def.default ?? 0)}
                      onChange={(v) => setSetup(def.tag, v)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {preference ? (
              <section>
                <h3 className="section-title">{PREF_INPUT_GROUP.title}</h3>
                <div className="track-state-cards">
                  {PREF_INPUT_GROUP.params.map((def) => (
                    <TrackStateCard
                      key={def.tag}
                      id={`in-pref-${def.tag}`}
                      def={def}
                      view={preferenceView(def.name)}
                      value={num(preference.tags, def.tag, def.default ?? 0)}
                      onChange={(v) => preference.onChange(def.tag, v)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </>
      ) : null}

      {sub === "eq" ? (
        <>
          <div className="tabs tabs-sub" role="tablist" aria-label="Input EQ">
            {eqChannels.map((ch) => (
              <button
                key={ch.section}
                type="button"
                role="tab"
                aria-selected={eqSection === ch.section}
                className={`tab ${eqSection === ch.section ? "active" : ""}`}
                onClick={() => setEqCh(ch.section)}
              >
                <Icon name={ch.linkTag === "E" ? "mic" : "guitar"} size={12} />
                {inputEqChannelLabel(ch, model.input)}
              </button>
            ))}
          </div>
          <EqPanel
            idPrefix={`in-eq-${eqSection}`}
            title={inputEqChannelLabel(
              INPUT_EQ_CHANNELS.find((c) => c.section === eqSection) ?? INPUT_EQ_CHANNELS[0],
              model.input,
            )}
            viewKey={`inputEq.view.${scope}`}
            params={INPUT_EQ_PARAMS}
            tags={eqTags}
            onChange={setEq}
          />
        </>
      ) : null}

      {sub === "dynamics" ? (
        <>
          <div className="meter-columns">
            {INPUT_DYNAMICS_GROUPS.filter(
              (group) => group.role !== "secondary" || !inputStereoLinked(model.input, "E"),
            ).flatMap((group) => {
              const title =
                group.linkTag && inputStereoLinked(model.input, group.linkTag)
                  ? (group.linkedTitle ?? group.title)
                  : group.title;
              return group.params.map((def) => (
                <ParamControl
                  key={def.tag}
                  id={`in-dyn-${def.tag}`}
                  def={{ ...def, name: `${title} ${def.name}` }}
                  value={num(model.input, def.tag, def.default ?? 0)}
                  onChange={(v) => setDynamics(def.tag, v)}
                  meter={{
                    ...(def.format === "comp" ? COMP_METER : NS_METER),
                    labelIcon: group.title.startsWith("MIC") ? "mic" : "guitar",
                  }}
                />
              ));
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
