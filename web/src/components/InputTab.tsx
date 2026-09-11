import {
  INPUT_DYNAMICS_GROUPS,
  INPUT_EQ_CHANNELS,
  INPUT_EQ_PARAMS,
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
import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import type { PatchHandler } from "./LoopTab";
import { ParamControl } from "./ParamControl";

type InputSub = "setup" | "eq" | "dynamics";

const SUBS: { id: InputSub; label: string; icon: IconName }[] = [
  { id: "setup", label: "Setup", icon: "system" },
  { id: "eq", label: "EQ", icon: "equalizer" },
  { id: "dynamics", label: "Dynamics", icon: "mfx" },
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
  const [sub, setSub] = useState<InputSub>("setup");
  const [eqCh, setEqCh] = useState<InputEqSection>("EQ_MIC1");
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
          <div className="channel-grid">
            {INPUT_SETUP_GROUPS.map((group) => (
              <section key={group.title} className="channel-card">
                <h3 className="section-title">{group.title}</h3>
                <div className="param-columns">
                  {group.params.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`in-setup-${def.tag}`}
                      def={def}
                      value={num(model.input, def.tag, def.default ?? 0)}
                      onChange={(v) => setSetup(def.tag, v)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {preference ? (
              <section className="channel-card">
                <h3 className="section-title">{PREF_INPUT_GROUP.title}</h3>
                <div className="param-columns">
                  {PREF_INPUT_GROUP.params.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`in-pref-${def.tag}`}
                      def={def}
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
          <h3 className="section-title">
            {inputEqChannelLabel(
              INPUT_EQ_CHANNELS.find((c) => c.section === eqSection) ?? INPUT_EQ_CHANNELS[0],
              model.input,
            )}
          </h3>
          <div className="param-columns">
            {INPUT_EQ_PARAMS.map((def) => (
              <ParamControl
                key={def.tag}
                id={`in-eq-${eqSection}-${def.tag}`}
                def={def}
                value={num(eqTags, def.tag, def.default ?? 0)}
                onChange={(v) => setEq(def.tag, v)}
              />
            ))}
          </div>
        </>
      ) : null}

      {sub === "dynamics" ? (
        <div className="channel-grid">
          {INPUT_DYNAMICS_GROUPS.filter(
            (group) => group.role !== "secondary" || !inputStereoLinked(model.input, "E"),
          ).map((group) => (
            <section key={group.title} className="channel-card">
              <h3 className="section-title">
                {group.linkTag && inputStereoLinked(model.input, group.linkTag)
                  ? (group.linkedTitle ?? group.title)
                  : group.title}
              </h3>
              <div className="param-columns">
                {group.params.map((def) => (
                  <ParamControl
                    key={def.tag}
                    id={`in-dyn-${def.tag}`}
                    def={def}
                    value={num(model.input, def.tag, def.default ?? 0)}
                    onChange={(v) => setDynamics(def.tag, v)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
