import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { usePersistedTab } from "../uiTabs";
import {
  MASTER_FX_PARAMS,
  OUTPUT_EQ_CHANNELS,
  OUTPUT_EQ_PARAMS,
  OUTPUT_EQ_SECTIONS,
  OUTPUT_INPUT_THRU,
  OUTPUT_PHONES_RHYTHM,
  OUTPUT_RHYTHM_OUT,
  OUTPUT_ROUTE_DESTS,
  OUTPUT_ROUTE_TRACK_BITS,
  OUTPUT_SETUP_GROUPS,
  PHONES_OUT_INDIVIDUAL,
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
  type ParamDef,
  type OutputLinkTag,
  type OutputRouteDest,
} from "@rc600/catalog/params";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { EqPanel } from "./EqPanel";
import { Icon, type IconName } from "./Icon";
import { InfoTip } from "./InfoTip";
import { depthColor, linkView, preferenceView } from "./InputTab";
import { TrackStateCard, onOffView, type PatchHandler, type TrackStateView } from "./LoopTab";
import { ParamControl, type MeterStyle } from "./ParamControl";

const OUTPUT_SUBS = ["setup", "routing", "eq", "mfx"] as const;
type OutputSub = (typeof OUTPUT_SUBS)[number];
const ROUTING_SUBS_IDS = ["track", "input", "phones"] as const;
type RoutingSub = (typeof ROUTING_SUBS_IDS)[number];
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

const OUTPUT_SETUP_VIEWS: Record<string, TrackStateView> = {
  A: {
    label: "Output Knob",
    variant: "output-knob",
    states: [
      { icon: "master", text: "All", title: "The OUTPUT LEVEL knob sets MASTER OUT and PHONES OUT." },
      {
        icon: "speaker",
        text: "Master",
        title: "The OUTPUT LEVEL knob sets MAIN / SUB 1 / SUB 2 only.",
        color: "#c084fc",
        alert: true,
      },
      {
        icon: "headphones",
        text: "Phones",
        title: "The OUTPUT LEVEL knob sets PHONES OUT only.",
        color: "#38bdf8",
        alert: true,
      },
      {
        icon: "volumeOff",
        text: "Off",
        title: "The OUTPUT LEVEL knob does nothing; only mixer levels apply.",
        color: "var(--warn)",
        alert: true,
      },
    ],
  },
  B: linkView("MAIN", "MAIN L and R"),
  C: linkView("SUB 1", "SUB 1 L and R"),
  D: linkView("SUB 2", "SUB 2 L and R"),
};

const MFX_INSERT_OFF = 6;
const mfxDepthColor = (v: number) => depthColor(v * 2.5);
const MFX_METERS: Record<string, MeterStyle> = {
  A: { caption: "Compressor", color: mfxDepthColor, valueIcon: "compressor" },
  B: { caption: "Reverb", color: mfxDepthColor, valueIcon: "reverb" },
};

function insertView(def: ParamDef): TrackStateView {
  return {
    label: "Insert",
    variant: "mfx-insert",
    states: (def.options ?? []).map((o) => {
      if (o.value === MFX_INSERT_OFF) {
        return {
          icon: "volumeOff",
          text: "Off",
          title: "Master FX are bypassed.",
          color: "var(--muted)",
          dim: true,
        };
      }
      const jack = o.value < 2 ? "main" : o.value < 4 ? "sub1" : "sub2";
      return {
        icon: jack === "main" ? "speaker" : "tune",
        text: o.label,
        title: `Comp and Reverb are applied to ${o.label}.`,
        color: jack === "sub1" ? "#c084fc" : jack === "sub2" ? "#38bdf8" : undefined,
        alert: jack !== "main",
      };
    }),
  };
}

function num(tags: TagMap, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function routeTrackView(track: string, destLabel: string): TrackStateView {
  const [off, on] = onOffView(
    destLabel,
    "play",
    `${track} is not sent to ${destLabel}.`,
    `${track} is sent to ${destLabel}.`,
  ).states;
  return {
    label: destLabel,
    variant: "input",
    states: [
      { ...off, icon: "volumeOff", text: track },
      { ...on, text: track },
    ],
  };
}

function sourceIcon(name: string): IconName {
  if (name.startsWith("MIC")) return "mic";
  if (name.startsWith("INST")) return "guitar";
  return "tempo";
}

function routeSourceView(source: string, destLabel: string): TrackStateView {
  const icon = sourceIcon(source);
  const [off, on] = onOffView(
    destLabel,
    icon,
    `${source} is not sent to ${destLabel}.`,
    `${source} is sent to ${destLabel}.`,
  ).states;
  return {
    label: destLabel,
    variant: "input",
    states: [
      { ...off, icon: "volumeOff", text: source },
      { ...on, text: source },
    ],
  };
}

const RHYTHM_OUT_VIEW: TrackStateView = {
  label: "Rhythm Out",
  variant: "rhythm-out",
  states: [
    { icon: "speaker", text: "Output", title: "Rhythm goes to the jacks set ON for Rhythm." },
    {
      icon: "loop",
      text: "Loop",
      title: "Rhythm is recorded into a loop or triggered from MIDI notes.",
      color: "#a78bfa",
      alert: true,
    },
  ],
};

const INPUT_THRU_VIEW: TrackStateView = {
  label: "Input Thru",
  variant: "input-thru",
  states: [
    {
      icon: "volumeOff",
      text: "Muted",
      title: "MIC and INST input is muted and not sent to any output jack.",
      color: "var(--warn)",
      alert: true,
    },
    { icon: "mic", text: "Thru", title: "MIC and INST input is sent to the output jacks." },
  ],
};

const PHONES_RHYTHM_VIEW: TrackStateView = {
  label: "Phones Rhythm",
  variant: "phones-rhythm",
  states: [
    {
      icon: "headphones",
      text: "Off",
      title: "Input and rhythm are not sent to PHONES.",
      color: "var(--muted)",
      dim: true,
    },
    { icon: "headphones", text: "On", title: "Input and rhythm are sent to PHONES." },
  ],
};

function phonesOutView(def: ParamDef): TrackStateView {
  return {
    label: "Phones Out",
    variant: "phones-out",
    states: (def.options ?? []).map((o) => {
      if (o.value === PHONES_OUT_INDIVIDUAL) {
        return {
          icon: "headphones",
          text: "Individual",
          title: "PHONES has its own routing on Track and Input/Rhythm.",
          color: "#f472b6",
          alert: true,
        };
      }
      const jack = o.value < 2 ? "main" : o.value < 4 ? "sub1" : "sub2";
      return {
        icon: jack === "main" ? "speaker" : "tune",
        text: o.label,
        title: `PHONES follows the ${o.label} routing.`,
        color: jack === "sub1" ? "#c084fc" : jack === "sub2" ? "#38bdf8" : undefined,
        alert: jack !== "main",
      };
    }),
  };
}

type RouteCell = { dest: OutputRouteDest; which: "tagTrack" | "tagInput"; bits: number[] };

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
  const [sub, setSub] = usePersistedTab<OutputSub>(`output.${scope}`, "setup", OUTPUT_SUBS);
  const [routingSub, setRoutingSub] = usePersistedTab<RoutingSub>(
    `outputRouting.${scope}`,
    "track",
    ROUTING_SUBS_IDS,
  );
  const [eqCh, setEqCh] = usePersistedTab<OutputEqSection>(
    `outputEq.${scope}`,
    "EQ_MAINOUTL",
    OUTPUT_EQ_SECTIONS,
  );
  const eqChannels = visibleOutputEqChannels(model.output);
  const eqSection = eqChannels.some((c) => c.section === eqCh)
    ? eqCh
    : (eqChannels[0]?.section ?? "EQ_MAINOUTL");
  const eqTags = model.outputEq[eqSection] ?? {};
  const dests = visibleOutputRouteDests(model.output, model.routing);
  const inputGroups = visibleOutputRouteInputGroups(model.input);
  const phonesValue = num(model.routing, "O");
  const phonesDef = phonesOutDef(model.output, phonesValue);
  const phonesOptions = phonesDef.options ?? [];
  const insertValue = num(model.masterFx, "C");
  const insertDef = masterFxInsertDef(model.output, insertValue);
  const insertOptions = insertDef.options ?? [];

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

  const routeCells = new Map<string, RouteCell>();
  for (const dest of dests) {
    for (const trk of OUTPUT_ROUTE_TRACK_BITS) {
      routeCells.set(`out-trk-${dest.id}-${trk.bit}`, { dest, which: "tagTrack", bits: [trk.bit] });
    }
    for (const src of inputGroups) {
      routeCells.set(`out-in-${dest.id}-${src.bits.join("-")}`, { dest, which: "tagInput", bits: src.bits });
    }
  }
  const suppressClick = useRef(false);

  function routeCellAt(target: Element | null): string | null {
    if (!target || target.closest(".info-tip")) return null;
    const id = target.closest(".play-state-param")?.querySelector(".play-state-btn")?.id;
    return id && routeCells.has(id) ? id : null;
  }

  /** Press toggles a routing card; dragging paints the same state onto every card crossed. */
  function startRoutePaint(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const first = routeCellAt(e.target as Element);
    if (!first) return;
    e.preventDefault();
    const cell = routeCells.get(first)!;
    const on = !bitOn(num(model.routing, cell.dest[cell.which]), cell.bits[0]!);
    const masks: Record<string, number> = {};
    const visited = new Set<string>();

    const paint = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      const { dest, which, bits } = routeCells.get(id)!;
      const partner = outputRouteLinkPartner(dest);
      const tags = [dest[which]];
      if (partner && dest.linkTag && outputStereoLinked(model.output, dest.linkTag)) tags.push(partner[which]);
      const partial: TagMap = {};
      for (const tag of tags) {
        let mask = masks[tag] ?? num(model.routing, tag);
        for (const bit of bits) mask = setBit(mask, bit, on);
        masks[tag] = mask;
        partial[tag] = String(mask);
      }
      patchRouting(partial);
    };

    const move = (ev: PointerEvent) => {
      const id = routeCellAt(document.elementFromPoint(ev.clientX, ev.clientY));
      if (id) paint(id);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };

    suppressClick.current = true;
    paint(first);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  const routePaintProps = {
    className: "setup-columns route-paint",
    onPointerDown: startRoutePaint,
    onClickCapture: (e: ReactMouseEvent) => {
      if (!suppressClick.current) return;
      e.stopPropagation();
      e.preventDefault();
    },
  };

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
        {sub === "setup" ? (
          <span className="tabs-help">
            <InfoTip
              label="Output Setup"
              text={
                preference
                  ? "System output defaults. Preference chooses whether each jack uses MEMORY or SYSTEM settings on the pedal."
                  : "Output knob, stereo link, routing, EQ, and Master FX are stored in this memory. MEMORY vs SYSTEM preference lives in System → Output → Setup."
              }
            />
          </span>
        ) : null}
        {sub === "mfx" ? (
          <span className="tabs-help">
            <InfoTip
              label="Master FX"
              text="Compressor and reverb on the final output. They are applied only to the jack chosen in Insert; OFF bypasses both."
            />
          </span>
        ) : null}
      </div>

      {sub === "setup" ? (
        <>
          <div className="setup-columns">
            {OUTPUT_SETUP_GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="section-title">{group.title}</h3>
                <div className="track-state-cards">
                  {group.params.map((def) => (
                    <TrackStateCard
                      key={def.tag}
                      id={`out-setup-${def.tag}`}
                      def={def}
                      view={OUTPUT_SETUP_VIEWS[def.tag]}
                      value={num(model.output, def.tag, def.default ?? 0)}
                      onChange={(v) => setSetup(def.tag, v)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {preference ? (
              <section>
                <h3 className="section-title">{PREF_OUTPUT_GROUP.title}</h3>
                <div className="track-state-cards">
                  {PREF_OUTPUT_GROUP.params.map((def) => (
                    <TrackStateCard
                      key={def.tag}
                      id={`out-pref-${def.tag}`}
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
            {routingSub === "phones" ? (
              <span className="tabs-help">
                <InfoTip
                  label="Phones Out"
                  text="INDIVIDUAL shows a PHONES destination on Track and Input/Rhythm. Other values follow that jack’s track routing."
                />
              </span>
            ) : null}
          </div>

          {routingSub === "track" ? (
            <div {...routePaintProps}>
              {dests.map((dest) => {
                const destLabel = outputRouteDestLabel(dest, model.output);
                const mask = num(model.routing, dest.tagTrack);
                return (
                  <section key={dest.id} aria-label={destLabel}>
                    <div className="track-state-cards">
                      {OUTPUT_ROUTE_TRACK_BITS.map((trk) => (
                        <TrackStateCard
                          key={trk.bit}
                          id={`out-trk-${dest.id}-${trk.bit}`}
                          def={{ tag: dest.tagTrack, name: trk.name, kind: "bool", info: trk.info }}
                          view={routeTrackView(trk.name, destLabel)}
                          value={bitOn(mask, trk.bit) ? 1 : 0}
                          onChange={(v) => setRouteBits(dest, "tagTrack", [trk.bit], Boolean(v))}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {routingSub === "input" ? (
            <div {...routePaintProps}>
              <section aria-label="Input/Rhythm">
                <div className="track-state-cards">
                  <TrackStateCard
                    id="out-rhythm-out"
                    def={OUTPUT_RHYTHM_OUT}
                    view={RHYTHM_OUT_VIEW}
                    value={num(model.routing, "Q", OUTPUT_RHYTHM_OUT.default ?? 0)}
                    onChange={(v) => patchRouting({ Q: String(v) })}
                  />
                  <TrackStateCard
                    id="out-input-thru"
                    def={OUTPUT_INPUT_THRU}
                    view={INPUT_THRU_VIEW}
                    value={num(model.routing, "P", OUTPUT_INPUT_THRU.default ?? 0)}
                    onChange={(v) => patchRouting({ P: String(v) })}
                  />
                  {phonesOutIndividual(model.routing) ? null : (
                    <TrackStateCard
                      id="out-phones-rhythm"
                      def={OUTPUT_PHONES_RHYTHM}
                      view={PHONES_RHYTHM_VIEW}
                      value={num(model.routing, "S", OUTPUT_PHONES_RHYTHM.default ?? 0)}
                      onChange={(v) => patchRouting({ S: String(v) })}
                    />
                  )}
                </div>
              </section>
              {dests.map((dest) => {
                const destLabel = outputRouteDestLabel(dest, model.output);
                const mask = num(model.routing, dest.tagInput);
                return (
                  <section key={dest.id} aria-label={destLabel}>
                    <div className="track-state-cards">
                      {inputGroups.map((src) => (
                        <TrackStateCard
                          key={src.name}
                          id={`out-in-${dest.id}-${src.bits.join("-")}`}
                          def={{ tag: dest.tagInput, name: src.name, kind: "bool", info: src.info }}
                          view={routeSourceView(src.name, destLabel)}
                          value={bitOn(mask, src.bits[0]) ? 1 : 0}
                          onChange={(v) => setRouteBits(dest, "tagInput", src.bits, Boolean(v))}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {routingSub === "phones" ? (
            <div className="setup-columns">
              <section aria-label="Phones Out">
                <div className="track-state-cards">
                  <TrackStateCard
                    id="out-phones-out"
                    def={phonesDef}
                    view={phonesOutView(phonesDef)}
                    value={Math.max(0, phonesOptions.findIndex((o) => o.value === phonesValue))}
                    onChange={(i) => patchRouting({ O: String(phonesOptions[i]?.value ?? 0) })}
                  />
                </div>
              </section>
            </div>
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
          <EqPanel
            idPrefix={`out-eq-${eqSection}`}
            title={outputEqChannelLabel(
              OUTPUT_EQ_CHANNELS.find((c) => c.section === eqSection) ?? OUTPUT_EQ_CHANNELS[0],
              model.output,
            )}
            viewKey={`outputEq.view.${scope}`}
            params={OUTPUT_EQ_PARAMS}
            tags={eqTags}
            onChange={setEq}
          />
        </>
      ) : null}

      {sub === "mfx" ? (
        <>
          <div className="mfx-columns">
            <TrackStateCard
              id="out-mfx-C"
              def={insertDef}
              view={insertView(insertDef)}
              value={Math.max(0, insertOptions.findIndex((o) => o.value === insertValue))}
              onChange={(i) => patchFx({ C: String(insertOptions[i]?.value ?? MFX_INSERT_OFF) })}
            />
            {insertValue === MFX_INSERT_OFF
              ? null
              : MASTER_FX_PARAMS.filter((def) => MFX_METERS[def.tag]).map((def) => (
                  <ParamControl
                    key={def.tag}
                    id={`out-mfx-${def.tag}`}
                    def={def}
                    value={num(model.masterFx, def.tag, def.default ?? 0)}
                    onChange={(v) => patchFx({ [def.tag]: String(v) })}
                    meter={MFX_METERS[def.tag]}
                  />
                ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
