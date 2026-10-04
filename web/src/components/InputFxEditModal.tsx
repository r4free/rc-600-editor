import {
  inputFxCategory,
  inputFxSeqParams,
  inputFxSeqSection,
  inputFxSeqTargets,
  inputFxSection,
  inputFxStepLayout,
  inputFxTypeLabel,
  inputFxTypeParams,
} from "@rc600/catalog/input-fx";
import { FX_BANKS, fxSlotSection } from "@rc600/catalog/params";
import { memoryTempo, type MemoryModel } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { cutLabelHz } from "../audio/chorusPreview";
import type { ReverbKind } from "../audio/reverbPreview";
import { ChorusPreviewBar } from "./ChorusPreviewBar";
import { ReverbPreviewBar } from "./ReverbPreviewBar";
import { FilterCutControl } from "./FilterCutControl";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";
import { Modal } from "./Modal";
import { ParamControl } from "./ParamControl";
import { onOffView, ScrubCard, TrackStateCard, type PatchHandler } from "./LoopTab";
import { rateCardValue, StepSequencer } from "./StepSequencer";

const DEFAULT_BPM = 120;

const PHASER_TYPE = 4;
const FLANGER_TYPE = 5;
const RING_MOD_TYPE = 9;
const TREMOLO_TYPE = 32;
const VIBRATO_TYPE = 33;
const CHORUS_TYPE = 48;
const REVERB_TYPE = 49;
const GATE_REVERB_TYPE = 50;
const REVERSE_REVERB_TYPE = 51;
const REVERB_TYPES = [
  {
    type: REVERB_TYPE,
    label: "Reverb",
    title: "Natural reverberation that fades out.",
  },
  {
    type: GATE_REVERB_TYPE,
    label: "Gate",
    title: "Reverb cut off before its natural length, once it falls below the Threshold.",
  },
  {
    type: REVERSE_REVERB_TYPE,
    label: "Reverse",
    title: "Gate reverb whose reverberation fades in instead of fading out.",
  },
];
const REVERB_MIX = "D.Level is the original sound, E.Level the reverb sound.";
const REVERB_FILTERS =
  "Lo Cut and High Cut trim the lows and highs of the reverb sound only (FLAT = no filtering).";
const MIX_PARAM = /^(D\.Level|E\.Level|Level|Oct\.Level|Balance)$/;

const GROUP_CAPTIONS: Record<number, { main: string; mix?: string }> = {
  [PHASER_TYPE]: {
    main: "Rate is how fast the swirl sweeps, Depth how wide it sweeps, Resonance how sharp it sounds, and Manual where the sweep is centered.",
    mix: "The swirl comes from mixing D.Level (original) with E.Level (phase-shifted). Keep both up for the classic phaser sound.",
  },
  [FLANGER_TYPE]: {
    main: "Rate is how fast the jet-plane whoosh sweeps, Depth how wide it sweeps, Resonance how metallic it rings, Manual where the sweep is centered, and Separation how wide it spreads between left and right.",
    mix: "The whoosh comes from mixing D.Level (original) with E.Level (slightly delayed). Keep both up for the classic flanger sound.",
  },
  [RING_MOD_TYPE]: {
    main: "Frequency is the pitch of the oscillator that multiplies your sound: low values wobble, high values sound metallic and bell-like.",
    mix: "Balance goes from the original sound (0) to the ring-modulated sound (100).",
  },
  [CHORUS_TYPE]: {
    main: "Rate is how fast the shimmer moves and Depth how strongly the doubled sound is detuned. Lo Cut and High Cut trim the lows and highs of the chorus sound only (FLAT = no filtering).",
    mix: "D.Level is the original sound, E.Level the chorus sound. Raise both for a wide, doubled sound.",
  },
  [TREMOLO_TYPE]: {
    main: "Rate is how fast the volume pulses, Depth how far it dips, and Waveform the shape: smooth and wavy at low values, choppy on/off at high values.",
    mix: "Level is the volume of the effect sound (50 keeps the same loudness).",
  },
  [VIBRATO_TYPE]: {
    main: "Rate is how fast the pitch wobbles, Depth is how far it swings, and Color makes the wobble less regular.",
    mix: "D.Level is the original sound, E.Level the sound with vibrato. Raise both for a chorus-like blend.",
  },
  [REVERB_TYPE]: {
    main: `Time is how long the reverb rings, Pre Delay the gap before it starts, and Density how smooth it sounds. ${REVERB_FILTERS}`,
    mix: REVERB_MIX,
  },
  [GATE_REVERB_TYPE]: {
    main: `Time is how long the reverb rings, Pre Delay the gap before it starts, and Threshold the level where the tail is cut off. ${REVERB_FILTERS}`,
    mix: REVERB_MIX,
  },
  [REVERSE_REVERB_TYPE]: {
    main: `Time is how long the reverb rings, Pre Delay the gap before it starts, and Gate Time when the swell begins to rise. ${REVERB_FILTERS}`,
    mix: REVERB_MIX,
  },
};

const CUT_PARAM = /^(Lo Cut|High Cut)$/;

function isSyncRate(def: { kind: string; name: string; options?: { label: string }[] }) {
  return def.kind === "enum" && def.name === "Rate" && def.options?.[0]?.label === "4MEAS";
}

function num(tags: Record<string, string | undefined>, tag: string, fallback = 0): number {
  const v = tags[tag];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function InputFxEditModal({
  model,
  bank,
  slot,
  type,
  onPatch,
  onClose,
  onOpenLibrary,
}: {
  model: MemoryModel;
  bank: number;
  slot: number;
  type: number;
  onPatch: PatchHandler;
  onClose: () => void;
  onOpenLibrary: () => void;
}) {
  const section = inputFxSection(bank, slot, type);
  const seqSection = inputFxSeqSection(bank, slot, type);
  const params = inputFxTypeParams(type);
  const title = inputFxTypeLabel(type);

  function setBlockTag(sec: string, tag: string, value: number) {
    const op: PatchOp = { type: "ifx", section: sec, tags: { [tag]: String(value) } };
    onPatch(op);
  }

  const target = (
    <div className="ifx-edit-head">
      <span className="ifx-library-target-slot">
        Bank {FX_BANKS[bank]} · FX {FX_BANKS[slot]} · {inputFxCategory(type)}
      </span>
    </div>
  );
  const actions = (
    <button type="button" className="btn" title="Open effect library" onClick={onOpenLibrary}>
      <Icon name="library" size={14} />
      Library
    </button>
  );

  if (!section || params.length === 0) {
    return (
      <Modal title={title} onClose={onClose} wide className="ifx-edit-modal" actions={actions}>
        {target}
        <p className="hint">This effect type has no editable parameters.</p>
      </Modal>
    );
  }

  const tags = model.ifxBlocks[section] ?? {};
  const layout = inputFxStepLayout(type);
  const stepSection = layout?.source === "seq" ? seqSection : section;
  const sequencerTags = new Set(
    layout?.source === "block"
      ? [
          ...layout.stepTags,
          ...(layout.lengthTags ?? []),
          layout.stepMaxTag,
          layout.rateTag,
          ...layout.headerTags,
        ]
      : [],
  );
  const blockParams = params.filter((def) => !sequencerTags.has(def.tag));
  const previewTags = layout?.previewTags;
  const seqTags = seqSection ? (model.ifxBlocks[seqSection] ?? {}) : {};
  const sequencedTag =
    layout?.source === "seq" && num(seqTags, "A") === 1
      ? inputFxSeqTargets(type)[num(seqTags, "D")]?.tag
      : undefined;
  const captions = GROUP_CAPTIONS[type];
  const reverbFamily = REVERB_TYPES.some((r) => r.type === type);
  const grouped = Boolean(layout || captions);
  const mainParams = grouped ? blockParams.filter((def) => !MIX_PARAM.test(def.name)) : blockParams;
  const mixParams = grouped ? blockParams.filter((def) => MIX_PARAM.test(def.name)) : [];
  const tagValue = (tag: string) => num(tags, tag, params.find((d) => d.tag === tag)?.default ?? 0);
  const vibrato =
    type === VIBRATO_TYPE
      ? {
          rateIndex: tagValue("A"),
          depth: tagValue("B"),
          color: tagValue("C"),
          dryLevel: tagValue("D"),
          wetLevel: tagValue("E"),
        }
      : undefined;
  const ring = type === RING_MOD_TYPE ? { frequency: tagValue("A"), balance: tagValue("B") } : undefined;
  const phaser =
    type === PHASER_TYPE
      ? {
          rateIndex: tagValue("A"),
          depth: tagValue("B"),
          resonance: tagValue("C"),
          manual: tagValue("D"),
          dryLevel: tagValue("E"),
          wetLevel: tagValue("F"),
        }
      : undefined;
  const flanger =
    type === FLANGER_TYPE
      ? {
          rateIndex: tagValue("A"),
          depth: tagValue("B"),
          resonance: tagValue("C"),
          manual: tagValue("D"),
          separation: tagValue("E"),
          dryLevel: tagValue("F"),
          wetLevel: tagValue("G"),
        }
      : undefined;
  const tremolo =
    type === TREMOLO_TYPE
      ? { rateIndex: tagValue("A"), depth: tagValue("B"), waveform: tagValue("C"), level: tagValue("D") }
      : undefined;
  const cutHz = (tag: string) =>
    cutLabelHz(params.find((d) => d.tag === tag)?.options?.find((o) => o.value === tagValue(tag))?.label);
  const chorus =
    type === CHORUS_TYPE
      ? {
          rateIndex: tagValue("A"),
          depth: tagValue("B"),
          loCutHz: cutHz("C"),
          hiCutHz: cutHz("D"),
          dryLevel: tagValue("E"),
          wetLevel: tagValue("F"),
        }
      : undefined;
  const reverb = reverbFamily
    ? {
        kind: (type === GATE_REVERB_TYPE ? "gate" : type === REVERSE_REVERB_TYPE ? "reverse" : "reverb") as ReverbKind,
        timeSec: tagValue("A") / 10,
        preDelayMs: tagValue("B"),
        density: type === REVERB_TYPE ? tagValue("C") : 10,
        threshold: type === GATE_REVERB_TYPE ? tagValue("C") : 0,
        gateTimeSec: type === REVERSE_REVERB_TYPE ? tagValue("C") / 10 : 0.5,
        loCutHz: cutHz("D"),
        hiCutHz: cutHz("E"),
        dryLevel: tagValue("F"),
        wetLevel: tagValue("G"),
      }
    : undefined;
  const defaultSound = ring
    ? "ring"
    : phaser
      ? "phaser"
      : flanger
        ? "flanger"
        : tremolo
          ? "tremolo"
          : undefined;

  function blockControl(def: (typeof params)[number]) {
    const value = num(tags, def.tag, def.default ?? 0);
    const id = `ifx-edit-${section}-${def.tag === "#" ? "hash" : def.tag}`;
    if (def.tag === previewTags?.depth) {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={100}
          format={(v) => ({ value: String(v), unit: "% Pattern" })}
          alert
          color="var(--slot-color)"
          valueIcon="mfx"
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (def.tag === previewTags?.compThreshold) {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={30}
          format={(v) => ({ value: String(v - 30), unit: "dB Threshold" })}
          alert
          color="#f59e0b"
          valueIcon="compressor"
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (def.tag === previewTags?.compGain) {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={20}
          format={(v) => ({ value: v === 0 ? "0" : `+${v}`, unit: "dB Gain" })}
          alert
          color="#fb7185"
          valueIcon="compressor"
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (grouped && def.kind === "bool") {
      return (
        <TrackStateCard
          key={def.tag}
          id={id}
          def={def}
          view={onOffView(def.name, "power", `${def.name} is off.`, `${def.name} is on.`)}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (grouped && def.kind === "enum" && CUT_PARAM.test(def.name)) {
      return (
        <FilterCutControl
          key={def.tag}
          id={id}
          def={def}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (isSyncRate(def)) {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={def.options?.[0]?.value ?? 0}
          max={def.options?.at(-1)?.value ?? 118}
          format={rateCardValue}
          alert
          color="var(--slot-color)"
          valueIcon="note"
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    return (
      <ParamControl
        key={def.tag}
        id={id}
        def={def}
        value={value}
        meter={
          grouped && def.kind === "int" && !MIX_PARAM.test(def.name)
            ? { caption: def.name, color: () => "var(--slot-color)" }
            : grouped && def.name === "Balance"
              ? { caption: "Direct ↔ Effect" }
              : undefined
        }
        onChange={(v) => setBlockTag(section!, def.tag, v)}
      />
    );
  }

  function control(def: (typeof params)[number]) {
    const sequenced = def.tag === sequencedTag;
    return (
      <div
        key={def.tag}
        className={`ifx-control${sequenced ? " is-sequenced" : ""}${CUT_PARAM.test(def.name) ? " is-wide" : ""}${def.format === "sec10" || def.format === "ms" ? " has-unit" : ""}`}
        title={sequenced ? "The step sequence is changing this parameter." : undefined}
      >
        {blockControl(def)}
        {sequenced ? <span className="ifx-control-badge">Steps</span> : null}
      </div>
    );
  }

  return (
    <Modal title={`Edit ${title}`} onClose={onClose} wide className="ifx-edit-modal" actions={actions}>
      {target}
      {layout && stepSection ? (
        <StepSequencer
          key={`${stepSection}-${type}`}
          idPrefix={`ifx-edit-${stepSection}`}
          layout={layout}
          defs={layout.source === "seq" ? inputFxSeqParams(type) : params}
          tags={model.ifxBlocks[stepSection] ?? {}}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          vibrato={vibrato}
          ring={ring}
          phaser={phaser}
          flanger={flanger}
          tremolo={tremolo}
          defaultSound={defaultSound}
          onSet={(next) => onPatch({ type: "ifx", section: stepSection, tags: next })}
        />
      ) : null}
      {chorus && !layout ? (
        <ChorusPreviewBar
          key={`${section}-${type}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={chorus}
        />
      ) : null}
      {reverb ? (
        <ReverbPreviewBar
          key={`reverb-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={reverb}
        />
      ) : null}
      {blockParams.length > 0 && !grouped ? (
        <section className="ifx-effect-controls" data-fx-slot={FX_BANKS[slot]!}>
          <div className="param-columns">{blockParams.map(blockControl)}</div>
        </section>
      ) : null}
      {blockParams.length > 0 && grouped ? (
        <section
          className={`ifx-effect-controls ifx-groups${mainParams.length > 0 && mixParams.length > 0 ? " has-mix" : ""}`}
          data-fx-slot={FX_BANKS[slot]!}
        >
          {mainParams.length > 0 ? (
            <div className="ifx-group">
              <div className="ifx-group-head">
                <h4>{title}</h4>
                {captions?.main ? <InfoTip label={title} text={captions.main} /> : null}
                {reverbFamily ? (
                  <div className="view-toggle ifx-type-toggle" role="radiogroup" aria-label="Reverb type">
                    {REVERB_TYPES.map((r) => (
                      <button
                        key={r.type}
                        type="button"
                        role="radio"
                        aria-checked={type === r.type}
                        className={`view-toggle-btn${type === r.type ? " active" : ""}`}
                        title={r.title}
                        onClick={() =>
                          type !== r.type &&
                          onPatch({ type: "ifx", section: fxSlotSection(bank, slot), tags: { C: String(r.type) } })
                        }
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="ifx-group-grid">{mainParams.map(control)}</div>
            </div>
          ) : null}
          {mixParams.length > 0 ? (
            <div className="ifx-group">
              <div className="ifx-group-head">
                <h4>Mix</h4>
                <InfoTip label="Mix" text={captions?.mix ?? "Volume of the original and the effect sound."} />
              </div>
              <div className="ifx-group-grid is-mix">{mixParams.map(control)}</div>
            </div>
          ) : null}
        </section>
      ) : null}
    </Modal>
  );
}
