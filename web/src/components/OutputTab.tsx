import { useState } from "react";
import {
  MASTER_FX_PARAMS,
  OUTPUT_EQ_CHANNELS,
  OUTPUT_EQ_PARAMS,
  OUTPUT_INPUT_THRU,
  OUTPUT_PHONES_RHYTHM,
  OUTPUT_RHYTHM_OUT,
  OUTPUT_ROUTE_DESTS,
  OUTPUT_ROUTE_TRACK_BITS,
  OUTPUT_SETUP_GROUPS,
  PREF_OUTPUT_GROUP,
  bitOn,
  masterFxInsertDef,
  mixerCopyForOutputLink,
  outputEqChannelLabel,
  outputEqLinkPartner,
  outputRouteDestLabel,
  outputRouteLinkPartner,
  outputStereoLinked,
  phonesOutDef,
  phonesOutIndividual,
  setBit,
  visibleOutputEqChannels,
  visibleOutputRouteDests,
  visibleOutputRouteInputGroups,
  type OutputEqSection,
  type OutputLinkTag,
  type OutputRouteDest,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { Icon, type IconName } from "./Icon";
import type { PatchHandler } from "./LoopTab";
import { ParamControl } from "./ParamControl";

type OutputSub = "setup" | "routing" | "eq" | "mfx";
type RoutingSub = "track" | "input" | "phones";

const SUBS: { id: OutputSub; label: string; icon: IconName }[] = [
  { id: "setup", label: "Setup", icon: "system" },
  { id: "routing", label: "Routing", icon: "chain" },
  { id: "eq", label: "EQ", icon: "equalizer" },
  { id: "mfx", label: "Master FX", icon: "reverb" },
];

const ROUTING_SUBS: { id: RoutingSub; label: string; icon: IconName }[] = [
  { id: "track", label: "Track", icon: "play" },
  { id: "input", label: "Input/Rhythm", icon: "mic" },
  { id: "phones", label: "Phones Out", icon: "master" },
];

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function destIcon(dest: OutputRouteDest): IconName {
  if (dest.phones) return "master";
  if (dest.id.startsWith("main")) return "master";
  return "tune";
}

export function OutputTab({
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
  const [sub, setSub] = useState<OutputSub>("setup");
  const [routingSub, setRoutingSub] = useState<RoutingSub>("track");
  const [eqCh, setEqCh] = useState<OutputEqSection>("EQ_MAINOUTL");
  const eqChannels = visibleOutputEqChannels(model.output);
  const eqSection = eqChannels.some((c) => c.section === eqCh)
    ? eqCh
    : (eqChannels[0]?.section ?? "EQ_MAINOUTL");
  const eqTags = model.outputEq[eqSection] ?? {};
  const dests = visibleOutputRouteDests(model.output, model.routing);
  const inputGroups = visibleOutputRouteInputGroups(model.input);
  const phonesValue = num(model.routing, "O");
  const insertValue = num(model.masterFx, "C");

  const sectionOp = (section: string, tags: TagMap): PatchOp => ({
    type: "section",
    section,
    tags,
    scope,
  });

  const patchOutput = (partial: TagMap) => onPatch(sectionOp("OUTPUT", partial));
  const patchRouting = (partial: TagMap) => onPatch(sectionOp("ROUTING", partial));
  const patchFx = (partial: TagMap) => onPatch(sectionOp("MASTER_FX", partial));

  function setSetup(tag: string, value: number) {
    const partial: TagMap = { [tag]: String(value) };
    if ((tag === "B" || tag === "C" || tag === "D") && value) {
      const linkTag = tag as OutputLinkTag;
      const primary = OUTPUT_ROUTE_DESTS.find((d) => d.linkTag === linkTag && d.role === "primary");
      const secondary = primary ? outputRouteLinkPartner(primary) : null;
      const eqPrimary = OUTPUT_EQ_CHANNELS.find((c) => c.linkTag === linkTag && c.role === "primary");
      const eqSecondary = OUTPUT_EQ_CHANNELS.find((c) => c.linkTag === linkTag && c.role === "secondary");
      const ops: PatchOp[] = [sectionOp("OUTPUT", partial)];
      if (eqPrimary && eqSecondary) {
        ops.push(sectionOp(eqSecondary.section, model.outputEq[eqPrimary.section] ?? {}));
      }
      if (primary && secondary) {
        ops.push(
          sectionOp("ROUTING", {
            [secondary.tagTrack]: model.routing[primary.tagTrack] ?? "0",
            [secondary.tagInput]: model.routing[primary.tagInput] ?? "0",
          }),
        );
      }
      ops.push(sectionOp("MIXER", mixerCopyForOutputLink(model.mixer, linkTag)));
      onPatch(ops);
      return;
    }
    patchOutput(partial);
  }

  function setEq(tag: string, value: number) {
    const partial = { [tag]: String(value) };
    const ops: PatchOp[] = [sectionOp(eqSection, partial)];
    const partner = outputEqLinkPartner(eqSection);
    const ch = OUTPUT_EQ_CHANNELS.find((c) => c.section === eqSection);
    if (partner && ch && outputStereoLinked(model.output, ch.linkTag)) {
      ops.push(sectionOp(partner, partial));
    }
    onPatch(ops);
  }

  function setRouteBits(dest: OutputRouteDest, which: "tagTrack" | "tagInput", bits: number[], on: boolean) {
    const tag = dest[which];
    let mask = num(model.routing, tag);
    for (const bit of bits) mask = setBit(mask, bit, on);
    const partial: TagMap = { [tag]: String(mask) };
    const partner = outputRouteLinkPartner(dest);
    if (partner && dest.linkTag && outputStereoLinked(model.output, dest.linkTag)) {
      let pmask = num(model.routing, partner[which]);
      for (const bit of bits) pmask = setBit(pmask, bit, on);
      partial[partner[which]] = String(pmask);
    }
    patchRouting(partial);
  }

  return (
    <div className="output-tab">
      <div className="tabs tabs-sub" role="tablist" aria-label="Output">
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
              ? "System output defaults. Preference chooses whether each jack uses MEMORY or SYSTEM settings on the pedal."
              : "Output knob, stereo link, routing, EQ, and Master FX are stored in this memory. MEMORY vs SYSTEM preference lives in System → Output → Setup."}
          </p>
          <div className="channel-grid">
            {OUTPUT_SETUP_GROUPS.map((group) => (
              <section key={group.title} className="channel-card">
                <h3 className="section-title">{group.title}</h3>
                <div className="param-columns">
                  {group.params.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`out-setup-${def.tag}`}
                      def={def}
                      value={num(model.output, def.tag, def.default ?? 0)}
                      onChange={(v) => setSetup(def.tag, v)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {preference ? (
              <section className="channel-card">
                <h3 className="section-title">{PREF_OUTPUT_GROUP.title}</h3>
                <div className="param-columns">
                  {PREF_OUTPUT_GROUP.params.map((def) => (
                    <ParamControl
                      key={def.tag}
                      id={`out-pref-${def.tag}`}
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

      {sub === "routing" ? (
        <>
          <div className="tabs tabs-sub" role="tablist" aria-label="Routing">
            {ROUTING_SUBS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={routingSub === t.id}
                className={`tab ${routingSub === t.id ? "active" : ""}`}
                onClick={() => setRoutingSub(t.id)}
              >
                <Icon name={t.icon} size={12} />
                {t.label}
              </button>
            ))}
          </div>

          {routingSub === "track" ? (
            <div className="channel-grid channel-grid-wide">
              {dests.map((dest) => (
                <section key={dest.id} className="channel-card">
                  <h3 className="section-title">{outputRouteDestLabel(dest, model.output)}</h3>
                  <div className="param-columns">
                    {OUTPUT_ROUTE_TRACK_BITS.map((trk) => {
                      const mask = num(model.routing, dest.tagTrack);
                      return (
                        <ParamControl
                          key={trk.bit}
                          id={`out-trk-${dest.id}-${trk.bit}`}
                          def={{ tag: dest.tagTrack, name: trk.name, kind: "bool", info: trk.info }}
                          value={bitOn(mask, trk.bit) ? 1 : 0}
                          onChange={(v) => setRouteBits(dest, "tagTrack", [trk.bit], Boolean(v))}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {routingSub === "input" ? (
            <>
              <div className="channel-grid channel-grid-wide">
                {dests.map((dest) => (
                  <section key={dest.id} className="channel-card">
                    <h3 className="section-title">{outputRouteDestLabel(dest, model.output)}</h3>
                    <div className="param-columns">
                      {inputGroups.map((src) => {
                        const mask = num(model.routing, dest.tagInput);
                        return (
                          <ParamControl
                            key={src.name}
                            id={`out-in-${dest.id}-${src.bits.join("-")}`}
                            def={{ tag: dest.tagInput, name: src.name, kind: "bool", info: src.info }}
                            value={bitOn(mask, src.bits[0]) ? 1 : 0}
                            onChange={(v) => setRouteBits(dest, "tagInput", src.bits, Boolean(v))}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <section className="channel-card" style={{ maxWidth: "28rem" }}>
                <h3 className="section-title">Input/Rhythm</h3>
                <div className="param-columns">
                  <ParamControl
                    id="out-rhythm-out"
                    def={OUTPUT_RHYTHM_OUT}
                    value={num(model.routing, "Q", OUTPUT_RHYTHM_OUT.default ?? 0)}
                    onChange={(v) => patchRouting({ Q: String(v) })}
                  />
                  <ParamControl
                    id="out-input-thru"
                    def={OUTPUT_INPUT_THRU}
                    value={num(model.routing, "P", OUTPUT_INPUT_THRU.default ?? 0)}
                    onChange={(v) => patchRouting({ P: String(v) })}
                  />
                  {phonesOutIndividual(model.routing) ? null : (
                    <ParamControl
                      id="out-phones-rhythm"
                      def={OUTPUT_PHONES_RHYTHM}
                      value={num(model.routing, "S", OUTPUT_PHONES_RHYTHM.default ?? 0)}
                      onChange={(v) => patchRouting({ S: String(v) })}
                    />
                  )}
                </div>
              </section>
            </>
          ) : null}

          {routingSub === "phones" ? (
            <>
              <p className="hint">
                INDIVIDUAL shows a PHONES destination on Track and Input/Rhythm. Other values follow
                that jack’s track routing.
              </p>
              <div className="param-columns">
                <ParamControl
                  id="out-phones-out"
                  def={phonesOutDef(model.output, phonesValue)}
                  value={phonesValue}
                  onChange={(v) => patchRouting({ O: String(v) })}
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {sub === "eq" ? (
        <>
          <div className="tabs tabs-sub" role="tablist" aria-label="Output EQ">
            {eqChannels.map((ch) => (
              <button
                key={ch.section}
                type="button"
                role="tab"
                aria-selected={eqSection === ch.section}
                className={`tab ${eqSection === ch.section ? "active" : ""}`}
                onClick={() => setEqCh(ch.section)}
              >
                <Icon
                  name={destIcon(
                    OUTPUT_ROUTE_DESTS.find((d) => d.linkTag === ch.linkTag) ?? OUTPUT_ROUTE_DESTS[0],
                  )}
                  size={12}
                />
                {outputEqChannelLabel(ch, model.output)}
              </button>
            ))}
          </div>
          <h3 className="section-title">
            {outputEqChannelLabel(
              OUTPUT_EQ_CHANNELS.find((c) => c.section === eqSection) ?? OUTPUT_EQ_CHANNELS[0],
              model.output,
            )}
          </h3>
          <div className="param-columns">
            {OUTPUT_EQ_PARAMS.map((def) => (
              <ParamControl
                key={def.tag}
                id={`out-eq-${eqSection}-${def.tag}`}
                def={def}
                value={num(eqTags, def.tag, def.default ?? 0)}
                onChange={(v) => setEq(def.tag, v)}
              />
            ))}
          </div>
        </>
      ) : null}

      {sub === "mfx" ? (
        <>
          <p className="hint">Compressor and reverb applied to the Insert destination.</p>
          <div className="param-columns">
            {MASTER_FX_PARAMS.map((def) => {
              const use = def.tag === "C" ? masterFxInsertDef(model.output, insertValue) : def;
              return (
                <ParamControl
                  key={def.tag}
                  id={`out-mfx-${def.tag}`}
                  def={use}
                  value={num(model.masterFx, def.tag, def.default ?? 0)}
                  onChange={(v) => patchFx({ [def.tag]: String(v) })}
                />
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
