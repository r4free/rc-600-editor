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
import { EqFaderBoard, eqDisplay, eqRange } from "./EqFaders";
import { Icon, type IconName } from "./Icon";
import { ScrubCard, TrackStateCard, type PatchHandler, type TrackStateView } from "./LoopTab";
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

function linkView(label: string, pair: string): TrackStateView {
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

function preferenceView(label: string): TrackStateView {
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

const EQ_SWITCH_TAG = "A";
/** Low to high, then output level. */
const EQ_CARD_ORDER = ["A", "K", "B", "D", "E", "F", "G", "H", "I", "C", "L", "J"];

const EQ_SWITCH_VIEW: TrackStateView = {
  label: "Switch",
  variant: "eq-switch",
  states: [
    { icon: "equalizer", text: "Off", title: "EQ is bypassed.", color: "var(--muted)", dim: true },
    { icon: "equalizer", text: "On", title: "EQ is applied.", alert: true },
  ],
};

const EQ_VIEWS = ["eq", "cards"] as const;
type EqView = (typeof EQ_VIEWS)[number];
const EQ_VIEW_OPTIONS: { id: EqView; label: string; icon: IconName; title: string }[] = [
  { id: "eq", label: "EQ", icon: "equalizer", title: "Vertical faders, like a graphic EQ." },
  { id: "cards", label: "Cards", icon: "blocks", title: "One card per parameter." },
];

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
  const [eqView, setEqView] = usePersistedTab<EqView>(`inputEq.view.${scope}`, "eq", EQ_VIEWS);
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
      </div>

      {sub === "setup" ? (
        <>
          <p className="hint">
            {preference
              ? "System input defaults. Preference chooses whether each jack uses MEMORY or SYSTEM settings on the pedal."
              : "Phantom power, INST gain, stereo link, EQ, and dynamics are stored in this memory. MEMORY vs SYSTEM preference lives in System → Input → Setup."}
          </p>
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
          <div className="eq-toolbar">
            <h3 className="section-title">
              {inputEqChannelLabel(
                INPUT_EQ_CHANNELS.find((c) => c.section === eqSection) ?? INPUT_EQ_CHANNELS[0],
                model.input,
              )}
            </h3>
            <div className="view-toggle" role="radiogroup" aria-label="EQ view">
              {EQ_VIEW_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={eqView === o.id}
                  className={`view-toggle-btn${eqView === o.id ? " active" : ""}`}
                  title={o.title}
                  onClick={() => setEqView(o.id)}
                >
                  <Icon name={o.icon} size={14} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {eqView === "eq" ? (
            <EqFaderBoard
              idPrefix={`in-eq-${eqSection}`}
              params={INPUT_EQ_PARAMS}
              switchTag={EQ_SWITCH_TAG}
              tags={eqTags}
              onChange={setEq}
            />
          ) : (
            <div className="track-state-cards">
              {EQ_CARD_ORDER.map((tag) => {
                const def = INPUT_EQ_PARAMS.find((p) => p.tag === tag);
                if (!def) return null;
                const id = `in-eq-${eqSection}-${def.tag}`;
                const value = num(eqTags, def.tag, def.default ?? 0);
                const onChange = (v: number) => setEq(def.tag, v);
                if (def.tag === EQ_SWITCH_TAG) {
                  return (
                    <TrackStateCard
                      key={def.tag}
                      id={id}
                      def={def}
                      view={EQ_SWITCH_VIEW}
                      value={value}
                      onChange={onChange}
                    />
                  );
                }
                return (
                  <ScrubCard
                    key={def.tag}
                    id={id}
                    def={def}
                    value={value}
                    {...eqRange(def)}
                    format={(v) => eqDisplay(def, v)}
                    alert={value !== (def.default ?? 0)}
                    onChange={onChange}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {sub === "dynamics" ? (
        <>
          <div className="track-state-cards">
            {INPUT_DYNAMICS_GROUPS.filter(
              (group) => group.role !== "secondary" || !inputStereoLinked(model.input, "E"),
            ).flatMap((group) => {
              const title =
                group.linkTag && inputStereoLinked(model.input, group.linkTag)
                  ? (group.linkedTitle ?? group.title)
                  : group.title;
              return group.params.map((def) => {
                const value = num(model.input, def.tag, def.default ?? 0);
                return (
                  <ScrubCard
                    key={def.tag}
                    id={`in-dyn-${def.tag}`}
                    def={{ ...def, name: `${title} ${def.name}` }}
                    value={value}
                    min={def.min ?? 0}
                    max={def.max ?? 0}
                    format={(v) =>
                      def.format === "comp" && v === 0 ? { value: "Off" } : { value: String(v) }
                    }
                    alert={value !== (def.default ?? 0)}
                    onChange={(v) => setDynamics(def.tag, v)}
                  />
                );
              });
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
