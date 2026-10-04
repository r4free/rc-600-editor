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
import { delayTimeSteps, nearestStep, type DelayKind } from "../audio/delayPreview";
import type { ReverbKind } from "../audio/reverbPreview";
import { DelayPreviewBar } from "./DelayPreviewBar";
import { ChorusPreviewBar } from "./ChorusPreviewBar";
import { ReverbPreviewBar } from "./ReverbPreviewBar";
import { FilterCutControl } from "./FilterCutControl";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";
import { Modal } from "./Modal";
import { ParamControl } from "./ParamControl";
import { PreampEditor } from "./PreampEditor";
import { PatternSlicerPreviewBar } from "./PatternSlicerPreviewBar";
import { PreampPreviewBar } from "./PreampPreviewBar";
import { onOffView, ScrubCard, TrackStateCard, type PatchHandler } from "./LoopTab";
import { rateCardValue, StepSequencer } from "./StepSequencer";

const DEFAULT_BPM = 120;

const FILTER_KINDS: Record<number, "lowpass" | "bandpass" | "highpass"> = { 1: "lowpass", 2: "bandpass", 3: "highpass" };
const FILTER_CAPTION = (what: string) =>
  `${what} Rate is how fast the filter sweeps on its own and Depth how far it sweeps around the Cutoff. Step Rate makes that sweep jump from value to value instead of gliding (OFF = smooth). The step sequence above is separate: its Sequence Rate sets how fast the steps advance, and Target picks whether the steps change Depth or Cutoff.`;
const FILTER_TYPES = [
  { type: 1, label: "LPF", title: "Low-pass: keeps the lows and cuts the highs above the Cutoff." },
  { type: 2, label: "BPF", title: "Band-pass: keeps only a band around the Cutoff and cuts lows and highs." },
  { type: 3, label: "HPF", title: "High-pass: keeps the highs and cuts the lows below the Cutoff." },
];
const PHASER_TYPE = 4;
const FLANGER_TYPE = 5;
const RING_MOD_TYPE = 9;
const AUTO_PAN_TYPE = 29;
const AUTO_PAN_METERS: Record<string, string> = {
  Waveform: "Smooth → Abrupt",
  Depth: "Pan width",
  "Init Phase": "Start point",
};
const PATTERN_SLICER_TYPE = 34;
const PATTERN_SLICER_METERS: Record<string, string> = {
  Duty: "Sound length",
  Attack: "Soft → Punchy",
};
const PREAMP_TYPE = 23;
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
const DELAY_TYPE = 36;
const PANNING_DELAY_TYPE = 37;
const REVERSE_DELAY_TYPE = 38;
const MOD_DELAY_TYPE = 39;
const DELAY_TYPES = [
  { type: DELAY_TYPE, label: "Delay", title: "Plain repeats of the sound." },
  { type: PANNING_DELAY_TYPE, label: "Panning", title: "Repeats that bounce between left and right (stereo)." },
  { type: REVERSE_DELAY_TYPE, label: "Reverse", title: "Repeats played backwards." },
  { type: MOD_DELAY_TYPE, label: "Mod", title: "Repeats with a gentle chorus-like wobble." },
];
const TYPE_FAMILIES = [
  { label: "Filter type", types: FILTER_TYPES },
  { label: "Reverb type", types: REVERB_TYPES },
  { label: "Delay type", types: DELAY_TYPES },
];
const DELAY_STEPS = delayTimeSteps();
const DELAY_NOTE_COUNT = 12;
const DELAY_CAPTION = (extra: string) =>
  `Time is the gap between repeats (a note length follows the tempo), Feedback how many repeats you hear${extra}. Lo Cut and High Cut trim the lows and highs of the repeats only (FLAT = no filtering).`;
const DELAY_MIX = "D.Level is the original sound, E.Level the repeats (up to 120 for louder repeats).";
const REVERB_MIX = "D.Level is the original sound, E.Level the reverb sound.";
const REVERB_FILTERS =
  "Lo Cut and High Cut trim the lows and highs of the reverb sound only (FLAT = no filtering).";
const MIX_PARAM = /^(D\.Level|E\.Level|Level|Oct\.Level|Balance)$/;

const GROUP_CAPTIONS: Record<number, { main: string; mix?: string; mixTitle?: string; mixMatch?: RegExp }> = {
  [PATTERN_SLICER_TYPE]: {
    main: "Cuts the sound in a rhythm so a sustained sound becomes a rhythmic backing. Rate is the length of each slice, Duty how much of each slice sounds (low = short and staccato, high = almost legato), Attack how hard each slice starts, Pattern which of the 20 built-in slice rhythms is used, and Depth how far the gaps drop (100 = silence, lower lets some sound through).",
    mixTitle: "Comp",
    mixMatch: /^Comp (Threshold|Gain)$/,
    mix: "A compressor after the slicer evens out the slices. Lower the Comp Threshold to compress more, and raise Comp Gain to bring the volume back up.",
  },
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
  1: {
    main: FILTER_CAPTION(
      "LPF (low-pass) keeps the lows and cuts the highs above the Cutoff; Resonance adds a sharp peak right at the Cutoff.",
    ),
  },
  2: {
    main: FILTER_CAPTION(
      "BPF (band-pass) keeps only a band of frequencies around the Cutoff and cuts both lows and highs, for a wah or telephone-like sound. Cutoff is the center of the band, and Resonance makes the band narrower and more nasal.",
    ),
  },
  3: {
    main: FILTER_CAPTION(
      "HPF (high-pass) keeps the highs and cuts the lows below the Cutoff, thinning the sound; Resonance adds a sharp peak right at the Cutoff.",
    ),
  },
  [AUTO_PAN_TYPE]: {
    main: "Rate is how fast the sound moves between left and right, Waveform whether it glides smoothly or jumps abruptly, Depth how far it travels, Init Phase where the movement starts when the effect is turned on, and Step Rate makes it jump to new positions in steps instead of gliding (OFF = smooth).",
  },
  [DELAY_TYPE]: { main: DELAY_CAPTION(""), mix: DELAY_MIX },
  [PANNING_DELAY_TYPE]: { main: DELAY_CAPTION(", bouncing between left and right"), mix: DELAY_MIX },
  [REVERSE_DELAY_TYPE]: { main: DELAY_CAPTION(", each one played backwards"), mix: DELAY_MIX },
  [MOD_DELAY_TYPE]: {
    main: DELAY_CAPTION(", and Mod Depth how much the repeats wobble"),
    mix: DELAY_MIX,
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

function delayTimeCardValue(def: { options?: { value: number; label: string }[] }, raw: number) {
  const label = def.options?.find((o) => o.value === raw)?.label ?? String(raw);
  if (label.endsWith(" ms")) return { value: label.slice(0, -3), unit: "ms" };
  if (label.endsWith("MEAS")) {
    const count = label.replace("MEAS", "");
    return { value: count, unit: count === "1" ? "Measure" : "Measures" };
  }
  if (label.endsWith("T")) return { value: label.slice(0, -1), unit: "Triplet" };
  return { value: label, unit: "Note" };
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
  const typeFamily = TYPE_FAMILIES.find((f) => f.types.some((r) => r.type === type));
  const delayFamily = DELAY_TYPES.some((r) => r.type === type);
  const grouped = Boolean(layout || captions);
  const mixMatch = captions?.mixMatch ?? MIX_PARAM;
  const mainParams = grouped ? blockParams.filter((def) => !mixMatch.test(def.name)) : blockParams;
  const mixParams = grouped ? blockParams.filter((def) => mixMatch.test(def.name)) : [];
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
  const filterKind = FILTER_KINDS[type];
  const filter = filterKind
    ? {
        kind: filterKind,
        rateIndex: tagValue("A"),
        depth: tagValue("B"),
        resonance: tagValue("C"),
        cutoff: tagValue("D"),
        stepRate: tagValue("E"),
      }
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
  const modDelay = type === MOD_DELAY_TYPE;
  const delay = delayFamily
    ? {
        kind: (type === PANNING_DELAY_TYPE
          ? "panning"
          : type === REVERSE_DELAY_TYPE
            ? "reverse"
            : modDelay
              ? "mod"
              : "delay") as DelayKind,
        timeRaw: tagValue("A"),
        feedback: tagValue("B"),
        modDepth: modDelay ? tagValue("C") : 0,
        dryLevel: tagValue(modDelay ? "D" : "C"),
        loCutHz: cutHz(modDelay ? "E" : "D"),
        hiCutHz: cutHz(modDelay ? "F" : "E"),
        wetLevel: tagValue(modDelay ? "G" : "F"),
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
  const patternSlicerPreview =
    type === PATTERN_SLICER_TYPE
      ? {
          rateIndex: tagValue("A"),
          duty: tagValue("B"),
          attack: tagValue("C"),
          pattern: tagValue("D"),
          depth: tagValue("E"),
          compThresholdDb: tagValue("F") - 30,
          compGainDb: tagValue("G"),
        }
      : undefined;
  const preamp =
    type === PREAMP_TYPE
      ? {
          ampType: tagValue("A"),
          speakerType: tagValue("B"),
          gain: tagValue("C"),
          tComp: tagValue("D"),
          bass: tagValue("E"),
          middle: tagValue("F"),
          treble: tagValue("G"),
          presence: tagValue("H"),
          micType: tagValue("I"),
          micDistance: tagValue("J"),
          micPosition: tagValue("K"),
          effectLevel: tagValue("L"),
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
    const patternSlicer = type === PATTERN_SLICER_TYPE;
    if (patternSlicer && def.name === "Pattern") {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={def.options?.at(-1)?.value ?? 19}
          format={(v) => ({ value: String(v + 1).padStart(2, "0"), unit: "Pattern" })}
          alert
          color="var(--slot-color)"
          valueIcon="blocks"
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (def.tag === previewTags?.depth || (patternSlicer && def.name === "Depth")) {
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
    if (def.tag === previewTags?.compThreshold || (patternSlicer && def.name === "Comp Threshold")) {
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
    if (def.tag === previewTags?.compGain || (patternSlicer && def.name === "Comp Gain")) {
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
    if (def.kind === "enum" && def.name === "Step Rate" && def.options?.[0]?.label === "OFF") {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={def.options.at(-1)?.value ?? 0}
          format={(v) => (v === 0 ? { value: "Off", unit: "Smooth" } : rateCardValue(v - 1))}
          alert={value !== 0}
          color="var(--slot-color)"
          valueIcon={value === 0 ? "power" : "note"}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (delayFamily && def.tag === "A") {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={nearestStep(DELAY_STEPS, value)}
          min={0}
          max={DELAY_STEPS.length - 1}
          format={(i) => delayTimeCardValue(def, DELAY_STEPS[i]!)}
          alert
          color="var(--slot-color)"
          valueIcon={value < DELAY_NOTE_COUNT ? "note" : "tempo"}
          onChange={(i) => setBlockTag(section!, def.tag, DELAY_STEPS[i]!)}
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
            ? {
                caption:
                  (type === AUTO_PAN_TYPE
                    ? AUTO_PAN_METERS[def.name]
                    : patternSlicer
                      ? PATTERN_SLICER_METERS[def.name]
                      : undefined) ?? def.name,
                color: () => "var(--slot-color)",
              }
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
          filter={filter}
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
      {delay ? (
        <DelayPreviewBar
          key={`delay-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={delay}
        />
      ) : null}
      {patternSlicerPreview ? (
        <PatternSlicerPreviewBar
          key={`pattern-slicer-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={patternSlicerPreview}
        />
      ) : null}
      {preamp ? (
        <PreampPreviewBar
          key={`preamp-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={preamp}
        />
      ) : null}
      {type === PREAMP_TYPE ? (
        <PreampEditor
          idPrefix={`ifx-edit-${section}`}
          params={params}
          tags={tags}
          onChange={(tag, value) => setBlockTag(section, tag, value)}
        />
      ) : null}
      {blockParams.length > 0 && !grouped && type !== PREAMP_TYPE ? (
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
                {typeFamily ? (
                  <div className="view-toggle ifx-type-toggle" role="radiogroup" aria-label={typeFamily.label}>
                    {typeFamily.types.map((r) => (
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
                <h4>{captions?.mixTitle ?? "Mix"}</h4>
                <InfoTip
                  label={captions?.mixTitle ?? "Mix"}
                  text={captions?.mix ?? "Volume of the original and the effect sound."}
                />
              </div>
              <div className="ifx-group-grid is-mix">{mixParams.map(control)}</div>
            </div>
          ) : null}
        </section>
      ) : null}
    </Modal>
  );
}
