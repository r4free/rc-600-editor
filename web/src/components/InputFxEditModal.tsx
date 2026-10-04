import { useState } from "react";
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
import { FX_BANKS, fxSlotSection, noteFromC1 } from "@rc600/catalog/params";
import { memoryTempo, type MemoryModel } from "@rc600/rc0/memory";
import type { PatchOp } from "@rc600/rc0/ops";
import { cutLabelHz } from "../audio/chorusPreview";
import { delayTimeSteps, nearestStep, tapeRepeatSec, type DelayKind } from "../audio/delayPreview";
import type { ReverbKind } from "../audio/reverbPreview";
import { DelayPreviewBar } from "./DelayPreviewBar";
import { eqLabelHz } from "../audio/eqPreview";
import { EqCurve } from "./EqCurve";
import { EqFaderBoard, type EqBand } from "./EqFaders";
import { EqPreviewBar } from "./EqPreviewBar";
import { FreezeEnvelope } from "./FreezeEnvelope";
import { FreezePreviewBar } from "./FreezePreviewBar";
import { ChorusPreviewBar } from "./ChorusPreviewBar";
import { ReverbPreviewBar } from "./ReverbPreviewBar";
import { FilterCutControl, ShelfGainControl } from "./FilterCutControl";
import { Icon } from "./Icon";
import { InfoTip } from "./InfoTip";
import { InputFxTypePickerModal } from "./InputFxTypePickerModal";
import { Modal } from "./Modal";
import { ParamControl } from "./ParamControl";
import { PreampEditor } from "./PreampEditor";
import { AutoRiffPreviewBar } from "./AutoRiffPreviewBar";
import { G2bPreviewBar } from "./G2bPreviewBar";
import { SlowGearPreviewBar } from "./SlowGearPreviewBar";
import { IsolatorBandControl } from "./IsolatorBandControl";
import { IntervalKeys, NoteKeys, noteNameOf, TransposeKeys } from "./TransposeKeys";
import { LofiPreviewBar } from "./LofiPreviewBar";
import { PhraseRoll } from "./PhraseRoll";
import { RadioLofiControl } from "./RadioLofiControl";
import { RadioPreviewBar } from "./RadioPreviewBar";
import { RobotPreviewBar } from "./RobotPreviewBar";
import { ElectricPreviewBar } from "./ElectricPreviewBar";
import { scaleNotes } from "../audio/electricPreview";
import { autoHarmonyMidi, degreeMidi, manualHarmonyMidi } from "../audio/harmonyPreview";
import { HarmonyPreviewBar } from "./HarmonyPreviewBar";
import { VocoderPreviewBar } from "./VocoderPreviewBar";
import { DistPedalPicker } from "./DistPedalPicker";
import { OscWavePicker } from "./OscWavePicker";
import { TwistPreviewBar } from "./TwistPreviewBar";
import { RollPreviewBar } from "./RollPreviewBar";
import { WarpPreviewBar } from "./WarpPreviewBar";
import { RollSplitPicker } from "./RollSplitPicker";
import { DistPreviewBar } from "./DistPreviewBar";
import { PatternSlicerPreviewBar } from "./PatternSlicerPreviewBar";
import { PreampPreviewBar } from "./PreampPreviewBar";
import { SustainerPreviewBar } from "./SustainerPreviewBar";
import { onOffView, ScrubCard, TrackStateCard, type PatchHandler, type TrackStateView } from "./LoopTab";
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
const RADIO_TYPE = 8;
const RING_MOD_TYPE = 9;
const AUTO_PAN_TYPE = 29;
const AUTO_PAN_METERS: Record<string, string> = {
  Waveform: "Smooth → Abrupt",
  Depth: "Pan width",
  "Init Phase": "Start point",
};
const SYNTH_TYPE = 6;
const SYNTH_METERS: Record<string, string> = {
  Frequency: "Filter frequency",
  Resonance: "Peak",
  Decay: "Sweep time",
};
const G2B_TYPE = 10;
const ALGORITHM_MODE_VIEW: TrackStateView = {
  label: "Mode",
  variant: "input",
  states: [
    { icon: "restore", text: "1 · Classic", title: "Mode 1: the algorithm from the previous RC series.", color: "#f59e0b", alert: true },
    { icon: "mfx", text: "2 · New", title: "Mode 2: the new algorithm." },
  ],
};
const AUTO_RIFF_TYPE = 12;
const SLOW_GEAR_TYPE = 13;
const TRANSPOSE_TYPE = 14;
const PITCH_BEND_TYPE = 15;
const ROBOT_TYPE = 16;
const ELECTRIC_TYPE = 17;
const HRM_MANUAL_TYPE = 18;
const HRM_AUTO_TYPE = 19;
const HRM_MIX = /^(Pan|D\.Level|Hrm Level)$/;
const VOCODER_TYPE = 20;
const OSC_VOC_TYPE = 21;
const OSC_VOC_METERS: Record<string, string> = {
  Attack: "Attack of the sound",
  Release: "Short → Long tail",
};
const OSC_BOT_TYPE = 22;
const OCTAVE_TYPE = 28;
const WARP_TYPE = 43;
const TWIST_TYPE = 44;
const ROLL1_TYPE = 45;
const ROLL2_TYPE = 46;
const ROLL_CAPTION = (algorithm: string, repeat: string, inf: string) => ({
  main: `Loops the input sound over a short cycle, splitting the length, for a stutter or drum-roll effect. ${algorithm} Time sets the loop rate (the length of the looped cycle). Roll splits that cycle into 1/2, 1/4, 1/8 or 1/16 for faster rolls. With Roll OFF, ${repeat} sets the number of repetitions${inf} (it is not used while Roll is on).`,
  mix: "Balance goes from the direct sound only (Direct) to the roll only (Roll); the middle blends both.",
});
const TWIST_RELEASE_VIEW: TrackStateView = {
  label: "Release",
  variant: "input",
  states: [
    { icon: "stop", text: "Fall", title: "Rotation stops when you switch the effect off." },
    { icon: "fadeOut", text: "Fade", title: "Switching off fades the sound out while it keeps rotating.", alert: true },
  ],
};
/** OCTAVE label → card value. */
function octaveCard(label: string): { value: string; unit: string } {
  if (label === "-2OCT") return { value: "−2", unit: "Two octaves below" };
  if (label.includes("&")) return { value: "−1 & −2", unit: "Both octaves below" };
  return { value: "−1", unit: "One octave below" };
}
const DIST_TYPE = 24;
const DIST_METERS: Record<string, string> = {
  Dist: "Clean → Saturated",
};
const VOCODER_METERS: Record<string, string> = {
  Attack: "Attack of the sound",
};
const TONE_BALANCE = {
  left: "Dark",
  right: "Bright",
  center: "0",
  value: (v: number) => (v === 50 ? "0" : `${v > 50 ? "+" : "−"}${Math.abs(v - 50)}`),
};
const MOD_SENS_BALANCE = {
  left: "Less",
  right: "More",
  center: "0",
  value: (v: number) => (v === 50 ? "0" : `${v > 50 ? "+" : "−"}${Math.abs(v - 50)}`),
};

/** Vocoder CARRIER label as a card value. */
function carrierCard(label: string): { value: string; unit: string } {
  const track = /^TRACK(\d)$/.exec(label);
  if (track) return { value: `Track ${track[1]}`, unit: "Carrier track" };
  return { value: label, unit: label.startsWith("MIC") ? "Mic input" : "Instrument input" };
}
const HRM_MODE_VIEW: TrackStateView = {
  label: "Hrm Mode",
  variant: "input",
  states: [
    {
      icon: "midi",
      text: "Hybrid",
      title: "HYBRID: the harmony follows the Key you set and the MIDI chords received.",
      color: "#f59e0b",
      alert: true,
    },
    { icon: "mfx", text: "Auto", title: "AUTO: the harmony follows the chords and chord progressions received." },
  ],
};

/** Harmonist VOICE label as a card value. */
function harmonyVoiceCard(label: string): { value: string; unit: string } {
  if (label === "OCT-") return { value: "−1", unit: "Octave below" };
  if (label === "OCT+") return { value: "+1", unit: "Octave above" };
  if (label === "UNISON") return { value: "Unison", unit: "Same melody" };
  const interval = /^([+-])(\d)(RD|TH)$/.exec(label);
  if (interval) {
    const up = interval[1] === "+";
    return { value: `${up ? "+" : "−"}${interval[2]}${interval[3]!.toLowerCase()}`, unit: up ? "Above" : "Below" };
  }
  const auto: Record<string, string> = {
    LOWER: "2nd chord note below",
    LOW: "Chord note below",
    HIGH: "Chord note above",
    HIGHER: "2nd chord note above",
  };
  return { value: label.charAt(0) + label.slice(1).toLowerCase(), unit: auto[label] ?? "Harmony" };
}
const ELECTRIC_METERS: Record<string, string> = {
  Speed: "Smooth → Robotic",
};
const FORMANT_BALANCE = {
  left: "Masculine",
  right: "Feminine",
  center: "Natural",
  value: (v: number) => (v === 50 ? "0 · Natural" : `${v > 50 ? "+" : "−"}${Math.abs(v - 50)}`),
};
const STABILITY_BALANCE = {
  left: "Changes easily",
  right: "Stable",
  center: "0",
  value: (v: number) => (v === 10 ? "0" : `${v > 10 ? "+" : "−"}${Math.abs(v - 10)}`),
};
const SLOW_GEAR_METERS: Record<string, string> = {
  Sens: "Picking sensitivity",
  "Rise Time": "Fast → Slow swell",
};
const AUTO_RIFF_METERS: Record<string, string> = {
  Attack: "Soft → Punchy",
};
const AUTO_RIFF_HOLD_VIEW: TrackStateView = {
  label: "Hold",
  variant: "input",
  states: [
    { icon: "note", text: "Off", title: "The riff stops when you stop playing.", color: "var(--muted)", dim: true },
    { icon: "note", text: "Hold", title: "The riff keeps playing after the input sound stops.", alert: true },
  ],
};
const AUTO_RIFF_LOOP_VIEW: TrackStateView = {
  label: "Loop",
  variant: "one-shot",
  states: [
    { icon: "oneShot", text: "Once", title: "The phrase plays once per note.", color: "#f59e0b", alert: true },
    { icon: "loop", text: "Loop", title: "The phrase repeats continuously." },
  ],
};

/** MODE 1 / 2 (previous RC series vs new algorithm). */
function isAlgorithmMode(def: { kind: string; name: string; options?: { label: string }[] }) {
  return def.kind === "enum" && def.name === "Mode" && def.options?.map((o) => o.label).join() === "1,2";
}

/** Pitch Bend PITCH option ("-3OCT" … "+4OCT", "0") as an octave count. */
function octaveShift(def: { options?: { value: number; label: string }[] }, raw: number): number {
  const label = def.options?.find((o) => o.value === raw)?.label ?? "0";
  const n = parseInt(label, 10);
  return Number.isFinite(n) ? n : 0;
}

function keyCardValue(label: string): { value: string; unit: string } {
  const m = /^(\S+) \((\S+)\)$/.exec(label);
  return m ? { value: m[1]!, unit: `Major · ${m[2]}` } : { value: label, unit: "Key" };
}
const LOFI_TYPE = 7;
const SUSTAINER_TYPE = 11;
const SUSTAINER_METERS: Record<string, string> = {
  Attack: "Pick attack",
  Release: "Leveling range",
  Sustain: "Sustain time",
};
const PATTERN_SLICER_TYPE = 34;
const PATTERN_SLICER_METERS: Record<string, string> = {
  Duty: "Sound length",
  Attack: "Soft → Punchy",
};
const ISOLATOR_TYPE = 27;
const ISOLATOR_METERS: Record<string, string> = {
  "Band Level": "Cut amount",
  Depth: "Steady → Pulsing",
};
const STEREO_ENHANCE_TYPE = 31;
const STEREO_ENHANCE_METERS: Record<string, string> = {
  Enhance: "Mono → Wide",
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
const EQ_FX_TYPE = 26;
const EQ_FX_BANDS: EqBand[] = [
  { title: "Low", faders: [{ tag: "A", short: "Gain" }] },
  {
    title: "Lo Mid",
    faders: [
      { tag: "F", short: "Freq" },
      { tag: "G", short: "Q" },
      { tag: "B", short: "Gain" },
    ],
  },
  {
    title: "Hi Mid",
    faders: [
      { tag: "H", short: "Freq" },
      { tag: "I", short: "Q" },
      { tag: "C", short: "Gain" },
    ],
  },
  { title: "High", faders: [{ tag: "D", short: "Gain" }] },
  { title: "Output", faders: [{ tag: "E", short: "Level" }] },
];
const FREEZE_TYPE = 47;
const FREEZE_ORDER = ["Attack", "Decay", "Sustain", "Release"];
const FREEZE_METERS: Record<string, string> = {
  Attack: "Fade-in time",
  Decay: "Time to settle",
  Sustain: "Held level",
  Release: "Fade-out time",
};
const TAPE_ECHO1_TYPE = 40;
const TAPE_ECHO2_TYPE = 41;
const TAPE_ECHO_TYPES = [
  { type: TAPE_ECHO1_TYPE, label: "Tape Echo1", title: "Operates using the algorithm from the previous RC series." },
  { type: TAPE_ECHO2_TYPE, label: "Tape Echo2", title: "Operates using a new algorithm." },
];
const TYPE_FAMILIES = [
  { label: "Filter type", types: FILTER_TYPES },
  { label: "Reverb type", types: REVERB_TYPES },
  { label: "Delay type", types: DELAY_TYPES },
  { label: "Tape echo", types: TAPE_ECHO_TYPES },
];
const TAPE_CAPTION = (algorithm: string, rate: string, tone: string) =>
  `A virtual tape echo that produces a realistic tape delay sound. ${algorithm} ${rate} Intensity sets the amount of delay repeats. ${tone}`;
const TAPE_METERS: Record<string, string> = {
  "Repeat Rate": "Slow tape → Fast tape",
  Intensity: "Amount of repeats",
};
const signed50 = (v: number) => (v === 50 ? "0" : `${v > 50 ? "+" : "−"}${Math.abs(v - 50)}`);
const BASS_BALANCE = { left: "Thin", right: "Full", center: "0", value: signed50 };
const TREBLE_BALANCE = { left: "Dark", right: "Bright", center: "0", value: signed50 };
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
  [SYNTH_TYPE]: {
    main: "Turns the input into a synthesizer sound: each note opens a resonant filter that then falls back down. Frequency sets where the filter settles (low = dark, high = bright), Resonance how sharp and vocal the filter peak sounds, and Decay how long each note's filter sweep takes (short = plucky, long = slow wah).",
    mix: "Balance goes from the direct sound only (Direct) to the synth sound only (Synth); the middle blends both.",
  },
  [SUSTAINER_TYPE]: {
    main: "Brings down loud input and makes quiet input louder, so notes ring longer at an even volume without distortion. Sustain sets how long notes keep ringing, Release how wide a range of levels is evened out (larger = longer sustain), and Attack how much of each pick's snap comes through.",
    mixTitle: "Tone",
    mixMatch: /^(Low Gain|Hi Gain|Level)$/,
    mix: "Low Gain and Hi Gain boost or cut the lows and highs (−20 to +20 dB, 0 = flat). Level is the volume of the effect sound.",
  },
  [G2B_TYPE]: {
    main: "Guitar to Bass turns your guitar into a bass sound, one octave lower. Mode picks the algorithm: 1 is the one from the previous RC series, 2 the new one.",
    mix: "Balance goes from the guitar only (Direct) to the bass only (Bass); the middle plays both.",
  },
  [SLOW_GEAR_TYPE]: {
    main: "A volume swell, like a violin or a guitar with the volume knob rolled up after each pick. Sens sets how hard you must pick to start a swell (higher = softer picks also swell), and Rise Time how long the sound takes to reach full volume. Mode picks the algorithm: 1 is the one from the previous RC series, 2 the new one.",
    mix: "Level is the volume of the effect sound.",
  },
  [TRANSPOSE_TYPE]: {
    main: "Transposes the sound when you turn the FX on. Trans sets how many semitones up or down (−12 to +12; 12 is an octave): pick it on the card or click a key on the keyboard, where C is the note you play. Mode picks the algorithm: 1 is the one from the previous RC series, 2 the new one. With Sequence ON, the steps above change Trans step by step (the middle of a bar = no change).",
  },
  [PITCH_BEND_TYPE]: {
    main: "Creates a pitch bend effect, usually swept with an expression pedal. Pitch sets how far the bend can go, in octaves (−3 to +4), and Bend how much of that range is applied (0 = the original pitch, 100 = the full Pitch amount). Mode picks the algorithm: 1 is the one from the previous RC series, 2 the new one. With Sequence ON, the steps above change Bend step by step, gliding between steps.",
  },
  [VOCODER_TYPE]: {
    main: "A vocoder: your voice (the audio input) shapes the sound of another source, the carrier, so a track or instrument seems to talk or sing. Carrier picks that source: one of the six tracks or an input (MIC1–INST2-R). If the chosen track is empty, you won't hear the vocoder. Tone makes the vocoder part darker or brighter, Attack sets the attack of the sound, and Mod Sens how strongly your voice controls the modulation. Carrier Thru (inputs only) sets whether the carrier is also heard on its own: OFF mutes it while the effect is on.",
    mix: "Balance goes from your direct voice only (Direct) to the vocoder only (Vocoder); the middle blends both.",
  },
  [OSC_VOC_TYPE]: {
    main: "Creates a vocoder sound based on the MIDI note messages received: an internal oscillator (the carrier) plays the notes you send to the RC-600 over MIDI, and your voice (the audio input) shapes it so it seems to talk or sing. Without MIDI notes there is no vocoder sound. Carrier picks the oscillator waveform and Octave its pitch. Tone makes the vocoder part darker or brighter, Attack sets the attack of the sound, Mod Sens how strongly your voice controls the modulation, and Release how long each note takes to fade after it ends.",
    mix: "Balance goes from your direct voice only (Direct) to the vocoder only (Vocoder); the middle blends both.",
  },
  [ROLL1_TYPE]: ROLL_CAPTION("Roll 1 operates using the algorithm from the previous RC series.", "Feedback", ""),
  [ROLL2_TYPE]: ROLL_CAPTION("Roll 2 operates using a new algorithm.", "Repeat", "; at the top it repeats forever (INF)"),
  [WARP_TYPE]: {
    main: "Produces a dream-like sound: while the effect is on, what you play melts into a slowly wobbling, washed-out haze. It has a single setting: Level, the volume of the effect sound.",
    mixMatch: /^$/,
  },
  [TWIST_TYPE]: {
    main: "Produces an aggressive sense of rotation that speeds up after you turn the effect on. Rise sets how long it takes to reach full rotation. Release selects how the rotation stops when you turn the effect off: Fall stops it at once, Fade fades the sound out while it keeps rotating, over the Fall time (Fall is only used with Fade).",
    mix: "Level is the volume of the effect sound.",
  },
  [OCTAVE_TYPE]: {
    main: "Adds a note one (or two) octaves lower, creating a richer sound. Octave selects the octave that will be sounded: −1, −2, or both together. The keyboard shows it: the note you play (outlined) and the octave notes added (lit). Mode picks the algorithm: 1 is the one from the previous RC series, 2 the new one. With Sequence ON, the steps above change Oct.Level step by step.",
    mix: "Oct.Level sets the volume of the octave sound added under your direct sound.",
  },
  [OSC_BOT_TYPE]: {
    main: "Plays an oscillator on the note set by Note, shaped by your voice (the audio input) so it sounds like a robot voice on one pitch. Combine it with the sequencer to play melodies and other phrases: with Sequence ON and Target Note, each step sets the note (0 = C1). Wave picks the oscillator waveform, Tone makes it darker or brighter, Attack sets the attack of the sound, and Mod Sens how strongly your voice controls the modulation.",
    mix: "Balance goes from your direct voice only (Direct) to the oscillator only (Oscillator); the middle blends both.",
  },
  [DIST_TYPE]: {
    main: "Effects that distort the sound. Type picks the pedal: VOCAL (voiced for vocals), BOOST (a clean boost with light grit), OD (overdrive), DS (distortion), METAL (high gain) or FUZZ. The selected pedal's knobs follow Level, Tone and Dist. Tone sets the tonal character (− darker, + brighter), and Dist the degree of distortion.",
    mix: "D.Level is the volume of the direct sound and E.Level the volume of the distorted sound.",
  },
  [HRM_MANUAL_TYPE]: {
    main: "Adds a harmony voice that matches the Key. Voice picks the harmony: an octave lower or higher, a diatonic interval of the key's scale (−6th to +6th, so 3rds and 6ths stay in the key), or Unison, which sounds like a second singer on the same melody. The keyboard shows an example: the tonic you sing (outlined) and the note the harmony sings (lit). Key sets the key the harmony follows, and Formant the character of the harmony voice (− more masculine, + more feminine).",
    mixMatch: HRM_MIX,
    mix: "Pan places the harmony left or right. D.Level is the volume of your own voice and Hrm Level the volume of the harmony.",
  },
  [HRM_AUTO_TYPE]: {
    main: "Adds a harmony based on the MIDI note messages received (chords and chord progressions), so send chords to the RC-600 over MIDI. Voice picks the harmony: an octave lower or higher, a chord note below (Low, Lower) or above (High, Higher) the melody, or Unison, which sounds like a second singer on the same melody. The keyboard shows an example over the key's major chord: the tonic you sing (outlined) and the note the harmony sings (lit). Hrm Mode picks the data used: Hybrid follows the Key you set plus the MIDI chords, Auto follows the chords and chord progressions alone. Formant sets the character of the harmony voice (− more masculine, + more feminine).",
    mixMatch: HRM_MIX,
    mix: "Pan places the harmony left or right. D.Level is the volume of your own voice and Hrm Level the volume of the harmony.",
  },
  [ELECTRIC_TYPE]: {
    main: "Electric Voice adjusts the pitch in steps to make the sound more mechanical, like a hard pitch-correction effect. Scale sets which notes it snaps to: CHROMATIC uses every semitone, a key uses only the notes of that key (lit on the keyboard; click a key to choose it). Speed sets how quickly the pitch jumps to each note (high = robotic steps, low = smoother), and Stability how easily it changes note (larger = more stable, less wobble). Shift transposes the voice (−12 to +12 semitones), and Formant changes its character (− more masculine, + more feminine).",
  },
  [ROBOT_TYPE]: {
    main: "A cyber-robot voice: whatever you sing or play comes out on one fixed pitch, keeping your rhythm and vowels. Note sets that pitch (pick it on the card or click a key), Formant shapes the character of the voice (− more masculine, + more feminine, 0 natural), and Mode picks the algorithm: 1 is the one from the previous RC series, 2 the new one.",
  },
  [AUTO_RIFF_TYPE]: {
    main: "Automatically plays a phrase built from each note you play. Play single notes: chords cannot be analyzed. Phrase picks one of the 30 built-in phrases, Tempo its speed (a note length follows the tempo), and Key the scale the phrase follows. Hold keeps the riff going after you stop playing, Loop repeats the phrase continuously instead of once, and Attack sets how loud the attack added to each phrase is.",
    mix: "Balance goes from the direct sound only (Direct) to the riff only (Riff); the middle blends both.",
  },
  [ISOLATOR_TYPE]: {
    main: "Divides the sound into three ranges (Low, Mid, High) and cuts one of them, in time with the tempo. Band picks the range that is cut, Band Level how much it is cut, Rate how fast the cut opens and closes, and Depth how far it opens (0 = a steady cut, 100 = the band comes fully back between cuts). With Sequence ON, the steps above change Depth step by step. Mode and Filter are stored with the effect but are not described in the Parameter Guide.",
  },
  [STEREO_ENHANCE_TYPE]: {
    main: "Gives a stereo feeling to a mono signal, spreading it between left and right. Enhance sets how wide it spreads (0 = no widening). Low Cut keeps the lows out of the widening so the bass stays solid in the center (FLAT = the whole sound is widened).",
    mix: "Level is the volume of the effect sound.",
  },
  [LOFI_TYPE]: {
    main: "Degrades the sound on purpose for a vintage, crunchy character. Bit Depth sets how many bits are kept: fewer bits sound grainier and noisier (8 is the classic sampler crunch, 1 is extreme). Sample Rate divides the sampling rate: lower fractions lose more highs and add a metallic edge. OFF leaves that part of the sound untouched.",
    mix: "Balance goes from the direct sound only (0) to the lo-fi sound only (100). 50 blends both equally.",
  },
  [RADIO_TYPE]: {
    main: "Produces a radio voice: the sound is squeezed into a narrow band of frequencies with some grit and hiss, like a small AM radio speaker. Lo-Fi sets the amount of blurring: low values keep a wider, clearer band, high values a thin, muffled one. The mini equalizer shows which frequencies get through.",
    mix: "Level is the volume of the effect sound (50 keeps about the same loudness).",
  },
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
  [EQ_FX_TYPE]: {
    main: "Adjusts the tone as an equalizer. Lo and High raise or lower the low and high ends; Lo-Mid and Hi-Mid raise or lower a band around their Freq, and Q sets how wide that band is (higher values narrow the area). Level sets the overall volume. Drag a fader, scroll or use the arrow keys; double-click resets it. The curve shows the resulting tone from 20 Hz to 20 kHz.",
    mixMatch: /^$/,
  },
  [FREEZE_TYPE]: {
    main: "This “freeze function” gives the effect of making sounds sustain indefinitely: when you switch the effect on, the sound at that moment is held. Attack sets the fade time until the held sound is output, Decay and Sustain shape how it settles and how strongly it keeps sounding, and Release sets the fade time over which it disappears when you switch the effect off. The drawing shows this envelope; the shaded part is while the switch is on.",
    mix: "Balance goes from the direct sound only (Direct) to the frozen sound only (Freeze); the middle blends both.",
  },
  [TAPE_ECHO1_TYPE]: {
    main: TAPE_CAPTION(
      "Tape Echo1 operates using the algorithm from the previous RC series.",
      "Repeat Rate sets the tape speed, shown as the gap between repeats (a note length follows the tempo).",
      "Low Cut and High Cut trim the lows and highs of the repeats only (FLAT = no filtering).",
    ),
    mix: DELAY_MIX,
  },
  [TAPE_ECHO2_TYPE]: {
    main: TAPE_CAPTION(
      "Tape Echo2 operates using a new algorithm.",
      "Repeat Rate sets the tape speed: a faster tape gives shorter gaps between repeats.",
      "Bass and Treble adjust the tone of the low and high frequency ranges (0 = unchanged).",
    ),
    mix: DELAY_MIX,
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

const CUT_PARAM = /^(Lo Cut|Low Cut|High Cut)$/;

function isSyncRate(def: { kind: string; name: string; options?: { label: string }[] }) {
  return def.kind === "enum" && (def.name === "Rate" || def.name === "Tempo") && def.options?.[0]?.label === "4MEAS";
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
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  function setBlockTag(sec: string, tag: string, value: number) {
    const op: PatchOp = { type: "ifx", section: sec, tags: { [tag]: String(value) } };
    onPatch(op);
  }

  const target = (
    <div className="ifx-edit-head">
      <span className="ifx-library-target-slot">
        Bank {FX_BANKS[bank]} · FX {FX_BANKS[slot]} · {inputFxCategory(type)}
      </span>
      <div className="ifx-type-picker">
        <span>Effect</span>
        <button
          type="button"
          className="btn ifx-type-picker-btn"
          aria-haspopup="dialog"
          title="Switch this slot to any RC-600 effect"
          onClick={() => setTypePickerOpen(true)}
        >
          <span>{type === 0 ? "THRU (bypass)" : title}</span>
          <Icon name="chevronDown" size={14} />
        </button>
        <InfoTip
          label="Effect"
          text="Pick any effect the RC-600 offers for this slot, not only the ready-made Library presets. Switching keeps each effect's own settings in the memory, so you can go back and forth; an effect you have not set up yet starts at the RC-600 defaults."
        />
      </div>
      {typePickerOpen ? (
        <InputFxTypePickerModal
          bank={bank}
          slot={slot}
          currentType={type}
          onClose={() => setTypePickerOpen(false)}
          onPick={(next) => {
            if (next !== type) onPatch({ type: "ifx", section: fxSlotSection(bank, slot), tags: { C: String(next) } });
            setTypePickerOpen(false);
          }}
        />
      ) : null}
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
  const delayFamily = DELAY_TYPES.some((r) => r.type === type) || type === TAPE_ECHO1_TYPE;
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
  const delay = type === TAPE_ECHO2_TYPE
    ? {
        kind: "tape" as DelayKind,
        timeRaw: 0,
        timeSec: tapeRepeatSec(tagValue("A")),
        feedback: tagValue("B"),
        modDepth: 0,
        dryLevel: tagValue("C"),
        bass: tagValue("D") - 50,
        treble: tagValue("E") - 50,
        loCutHz: null,
        hiCutHz: null,
        wetLevel: tagValue("F"),
      }
    : delayFamily
    ? {
        kind: (type === TAPE_ECHO1_TYPE
          ? "tape"
          : type === PANNING_DELAY_TYPE
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
  const synth =
    type === SYNTH_TYPE
      ? { frequency: tagValue("A"), resonance: tagValue("B"), decay: tagValue("C"), balance: tagValue("D") }
      : undefined;
  const sustainer =
    type === SUSTAINER_TYPE
      ? {
          attack: tagValue("A"),
          release: tagValue("B"),
          level: tagValue("C"),
          lowGain: tagValue("D"),
          hiGain: tagValue("E"),
          sustain: tagValue("F"),
        }
      : undefined;
  const transpose = type === TRANSPOSE_TYPE ? { trans: tagValue("A") } : undefined;
  const pitchBend = type === PITCH_BEND_TYPE ? { pitch: tagValue("A"), bend: tagValue("B") } : undefined;
  const isolator =
    type === ISOLATOR_TYPE
      ? { band: tagValue("A"), rateIndex: tagValue("B"), bandLevel: tagValue("C"), depth: tagValue("D") }
      : undefined;
  const g2b = type === G2B_TYPE ? { balance: tagValue("A"), mode: tagValue("B") } : undefined;
  const slowGear =
    type === SLOW_GEAR_TYPE
      ? { sens: tagValue("A"), riseTime: tagValue("B"), level: tagValue("C"), mode: tagValue("D") }
      : undefined;
  const autoRiff =
    type === AUTO_RIFF_TYPE
      ? {
          phrase: tagValue("A"),
          rateIndex: tagValue("B"),
          hold: tagValue("C") === 1,
          attack: tagValue("D"),
          loop: tagValue("E") === 1,
          key: tagValue("F"),
          balance: tagValue("G"),
        }
      : undefined;
  const vocoder =
    type === VOCODER_TYPE
      ? {
          carrier: tagValue("A"),
          tone: tagValue("B"),
          attack: tagValue("C"),
          modSens: tagValue("D"),
          balance: tagValue("E"),
          carrierThru: tagValue("F") === 1,
        }
      : undefined;
  const warp = type === WARP_TYPE ? { level: tagValue("A") } : undefined;
  const roll =
    type === ROLL1_TYPE || type === ROLL2_TYPE
      ? {
          time: tagValue("A"),
          repeat: tagValue("B"),
          roll: tagValue("C"),
          balance: tagValue("D"),
          infiniteAtMax: type === ROLL2_TYPE,
        }
      : undefined;
  const twist =
    type === TWIST_TYPE
      ? { release: tagValue("A"), rise: tagValue("B"), fall: tagValue("C"), level: tagValue("D") }
      : undefined;
  const octave = type === OCTAVE_TYPE ? { mode: tagValue("A"), level: tagValue("B") } : undefined;
  const eqHz = (tag: string, fallback: number) =>
    eqLabelHz(params.find((d) => d.tag === tag)?.options?.find((o) => o.value === tagValue(tag))?.label, fallback);
  const eqQ = (tag: string) =>
    parseFloat(params.find((d) => d.tag === tag)?.options?.find((o) => o.value === tagValue(tag))?.label ?? "1") || 1;
  const eqFx =
    type === EQ_FX_TYPE
      ? {
          lo: tagValue("A") - 20,
          loMid: tagValue("B") - 20,
          hiMid: tagValue("C") - 20,
          high: tagValue("D") - 20,
          level: tagValue("E") - 20,
          loMidHz: eqHz("F", 800),
          loMidQ: eqQ("G"),
          hiMidHz: eqHz("H", 3150),
          hiMidQ: eqQ("I"),
        }
      : undefined;
  const freeze =
    type === FREEZE_TYPE
      ? {
          attack: tagValue("A"),
          release: tagValue("B"),
          decay: tagValue("C"),
          sustain: tagValue("D"),
          balance: tagValue("E"),
        }
      : undefined;
  const oscBot =
    type === OSC_BOT_TYPE
      ? {
          wave: tagValue("A"),
          tone: tagValue("B"),
          attack: tagValue("C"),
          note: tagValue("D"),
          modSens: tagValue("E"),
          balance: tagValue("F"),
        }
      : undefined;
  const oscVocoder =
    type === OSC_VOC_TYPE
      ? {
          carrier: 0,
          carrierThru: false,
          tone: tagValue("B"),
          attack: tagValue("C"),
          modSens: tagValue("E"),
          balance: tagValue("G"),
          osc: { wave: tagValue("A"), octave: tagValue("D"), release: tagValue("F") },
        }
      : undefined;
  const dist =
    type === DIST_TYPE
      ? { type: tagValue("A"), tone: tagValue("B"), dist: tagValue("C"), dLevel: tagValue("D"), eLevel: tagValue("E") }
      : undefined;
  const harmonyAuto = type === HRM_AUTO_TYPE;
  const harmony =
    type === HRM_MANUAL_TYPE || harmonyAuto
      ? {
          kind: (harmonyAuto ? "auto" : "manual") as "auto" | "manual",
          voice: tagValue("A"),
          formant: tagValue("B"),
          pan: tagValue("C"),
          key: tagValue(harmonyAuto ? "E" : "D"),
          dLevel: tagValue(harmonyAuto ? "F" : "E"),
          hrmLevel: tagValue(harmonyAuto ? "G" : "F"),
        }
      : undefined;
  const electric =
    type === ELECTRIC_TYPE
      ? {
          shift: tagValue("A"),
          formant: tagValue("B"),
          speed: tagValue("C"),
          stability: tagValue("D"),
          scale: tagValue("E"),
        }
      : undefined;
  const robot =
    type === ROBOT_TYPE ? { note: tagValue("A"), formant: tagValue("B"), mode: tagValue("C") } : undefined;
  const radio = type === RADIO_TYPE ? { lofi: tagValue("A"), level: tagValue("B") } : undefined;
  const lofi =
    type === LOFI_TYPE
      ? { bitDepthRaw: tagValue("A"), sampleRateRaw: tagValue("B"), balance: tagValue("D") }
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
          : isolator || oscBot
            ? "beat"
            : undefined;

  function blockControl(def: (typeof params)[number]) {
    const value = num(tags, def.tag, def.default ?? 0);
    const id = `ifx-edit-${section}-${def.tag === "#" ? "hash" : def.tag}`;
    if (isShelfGain(def)) {
      return (
        <ShelfGainControl
          key={def.tag}
          id={id}
          def={def}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === LOFI_TYPE && (def.name === "Bit Depth" || def.name === "Sample Rate")) {
      const bits = def.name === "Bit Depth";
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={def.options?.at(-1)?.value ?? 31}
          format={(v) => {
            const label = def.options?.find((o) => o.value === v)?.label ?? String(v);
            if (v === 0) return { value: "Off", unit: "Clean" };
            return bits ? { value: label, unit: label === "1" ? "Bit" : "Bits" } : { value: label, unit: "Sample rate" };
          }}
          alert={value !== 0}
          color="var(--slot-color)"
          valueIcon={value === 0 ? "power" : bits ? "equalizer" : "mfx"}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === RADIO_TYPE && def.name === "Lo-Fi") {
      return (
        <RadioLofiControl
          key={def.tag}
          id={id}
          def={def}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === ROBOT_TYPE && def.name === "Note") {
      const noteName = (v: number) => def.options?.find((o) => o.value === v)?.label ?? String(v);
      return (
        <div key={def.tag} className="riff-phrase">
          <ScrubCard
            id={id}
            def={def}
            value={value}
            min={0}
            max={def.options?.at(-1)?.value ?? 11}
            format={(v) => ({ value: noteName(v), unit: "Robot pitch" })}
            alert
            color="var(--slot-color)"
            valueIcon="piano"
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
          <NoteKeys
            note={value}
            noteName={noteName}
            caption={`Every note comes out as ${noteName(value)}`}
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
        </div>
      );
    }
    if ((type === ROLL1_TYPE || type === ROLL2_TYPE) && def.name === "Roll") {
      return (
        <RollSplitPicker
          key={def.tag}
          id={id}
          def={def}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === TWIST_TYPE && def.name === "Release") {
      return (
        <TrackStateCard
          key={def.tag}
          id={id}
          def={def}
          view={TWIST_RELEASE_VIEW}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === OCTAVE_TYPE && def.name === "Octave") {
      const labelOf = (v: number) => def.options?.find((o) => o.value === v)?.label ?? "-1OCT";
      const played = 60;
      const targets = value === 1 ? [36] : value === 2 ? [48, 36] : [48];
      return (
        <div key={def.tag} className="riff-phrase">
          <ScrubCard
            id={id}
            def={def}
            value={value}
            min={0}
            max={def.options?.at(-1)?.value ?? 2}
            format={(v) => octaveCard(labelOf(v))}
            alert
            color="var(--slot-color)"
            valueIcon="fadeOut"
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
          <IntervalKeys
            low={36}
            high={71}
            origin={played}
            targets={targets}
            label="Octave example"
            caption={`You play ${noteNameOf(played)}4 → adds ${targets.map((m) => `${noteNameOf(m)}${Math.floor(m / 12) - 1}`).join(" and ")}`}
          />
        </div>
      );
    }
    if (type === OSC_BOT_TYPE && def.name === "Note") {
      const max = def.max ?? 103;
      const octaveBase = value - (value % 12);
      return (
        <div key={def.tag} className="riff-phrase">
          <ScrubCard
            id={id}
            def={def}
            value={value}
            min={0}
            max={max}
            format={(v) => ({ value: noteFromC1(v), unit: `Octave ${1 + Math.floor(v / 12)}` })}
            alert
            color="var(--slot-color)"
            valueIcon="piano"
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
          <NoteKeys
            note={value % 12}
            noteName={(k) => noteNameOf(k)}
            caption={`The oscillator plays ${noteFromC1(value)}; click a key to pick a note in octave ${1 + Math.floor(value / 12)}`}
            onChange={(k) => setBlockTag(section!, def.tag, Math.min(max, octaveBase + k))}
          />
        </div>
      );
    }
    if ((type === OSC_VOC_TYPE || type === OSC_BOT_TYPE) && (def.name === "Carrier" || def.name === "Wave")) {
      return (
        <OscWavePicker
          key={def.tag}
          id={id}
          def={def}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if ((type === PITCH_BEND_TYPE && def.name === "Pitch") || (type === OSC_VOC_TYPE && def.name === "Octave")) {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={def.options?.at(-1)?.value ?? 7}
          format={(v) => {
            const oct = octaveShift(def, v);
            return oct === 0
              ? { value: "0", unit: "No shift" }
              : { value: `${oct > 0 ? "+" : "−"}${Math.abs(oct)}`, unit: Math.abs(oct) === 1 ? "Octave" : "Octaves" };
          }}
          alert={octaveShift(def, value) !== 0}
          color="var(--slot-color)"
          valueIcon={octaveShift(def, value) < 0 ? "fadeOut" : "fadeIn"}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === DIST_TYPE && def.name === "Type") {
      return (
        <DistPedalPicker
          key={def.tag}
          id={id}
          def={def}
          value={value}
          knobs={[tagValue("E"), tagValue("B"), tagValue("C")]}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === VOCODER_TYPE && def.name === "Carrier") {
      const labelOf = (v: number) => def.options?.find((o) => o.value === v)?.label ?? String(v);
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={def.options?.at(-1)?.value ?? 11}
          format={(v) => carrierCard(labelOf(v))}
          alert
          color="var(--slot-color)"
          valueIcon={value >= 6 ? "loop" : labelOf(value).startsWith("MIC") ? "mic" : "guitar"}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === VOCODER_TYPE && def.name === "Carrier Thru") {
      const trackCarrier = tagValue("A") >= 6;
      return (
        <TrackStateCard
          key={def.tag}
          id={id}
          def={def}
          group={trackCarrier ? "Inputs only — not used with a track" : undefined}
          view={onOffView(
            "Carrier Thru",
            "master",
            "The carrier is muted while the effect is on.",
            "The carrier is also heard on its own.",
          )}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if ((type === HRM_MANUAL_TYPE || type === HRM_AUTO_TYPE) && def.name === "Voice") {
      const labelOf = (v: number) => def.options?.find((o) => o.value === v)?.label ?? String(v);
      const card = (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={def.options?.at(-1)?.value ?? 0}
          format={(v) => harmonyVoiceCard(labelOf(v))}
          alert
          color="var(--slot-color)"
          valueIcon="mic"
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
      if (!harmony) return card;
      const sung = degreeMidi(harmony.key, 0);
      const target =
        type === HRM_AUTO_TYPE ? autoHarmonyMidi(harmony.key, 0, 0, value) : manualHarmonyMidi(harmony.key, 0, value);
      const keyName = params.find((d) => d.name === "Key")?.options?.find((o) => o.value === harmony.key)?.label;
      const context = type === HRM_AUTO_TYPE ? `over a ${keyName?.split(" ")[0] ?? "C"} major chord` : `Key ${keyName ?? ""}`;
      return (
        <div key={def.tag} className="riff-phrase">
          {card}
          <IntervalKeys
            low={48}
            high={83}
            origin={sung}
            targets={[target]}
            label="Harmony example"
            caption={`You sing ${noteNameOf(sung)} → harmony sings ${noteNameOf(target)}${target === sung ? " (doubled)" : target < sung ? " below" : " above"} · ${context}`}
          />
        </div>
      );
    }
    if ((type === HRM_MANUAL_TYPE || type === HRM_AUTO_TYPE) && def.name === "Key") {
      return (
        <ScrubCard
          key={def.tag}
          id={id}
          def={def}
          value={value}
          min={0}
          max={def.options?.at(-1)?.value ?? 11}
          format={(v) => keyCardValue(def.options?.find((o) => o.value === v)?.label ?? String(v))}
          alert
          color="var(--slot-color)"
          valueIcon="piano"
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === HRM_AUTO_TYPE && def.name === "Hrm Mode") {
      return (
        <TrackStateCard
          key={def.tag}
          id={id}
          def={def}
          view={HRM_MODE_VIEW}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === ELECTRIC_TYPE && def.name === "Scale") {
      const chromatic = value === 0;
      const tonic = chromatic ? null : (value - 1) % 12;
      const keyLabel = def.options?.find((o) => o.value === value)?.label ?? "";
      const noteName = (k: number) => def.options?.find((o) => o.value === k + 1)?.label.split(" ")[0] ?? String(k);
      return (
        <div key={def.tag} className="riff-phrase">
          <ScrubCard
            id={id}
            def={def}
            value={value}
            min={0}
            max={def.options?.at(-1)?.value ?? 12}
            format={(v) =>
              v === 0
                ? { value: "Chromatic", unit: "Every semitone" }
                : keyCardValue(def.options?.find((o) => o.value === v)?.label ?? String(v))
            }
            alert={!chromatic}
            color="var(--slot-color)"
            valueIcon="piano"
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
          <NoteKeys
            note={tonic}
            noteName={(k) => `${noteName(k)}: snap to this key`}
            lit={scaleNotes(value)}
            caption={chromatic ? "Snaps to every semitone" : `Snaps to the notes of ${keyLabel}`}
            onChange={(k) => setBlockTag(section!, def.tag, k + 1)}
          />
        </div>
      );
    }
    if ((type === TRANSPOSE_TYPE && def.name === "Trans") || (type === ELECTRIC_TYPE && def.name === "Shift")) {
      const semis = value - 12;
      return (
        <div key={def.tag} className="riff-phrase">
          <ScrubCard
            id={id}
            def={def}
            value={value}
            min={0}
            max={24}
            format={(v) => ({
              value: v === 12 ? "0" : `${v > 12 ? "+" : "−"}${Math.abs(v - 12)}`,
              unit: Math.abs(v - 12) === 1 ? "Semitone" : "Semitones",
            })}
            alert={semis !== 0}
            color="var(--slot-color)"
            valueIcon="piano"
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
          <TransposeKeys semitones={semis} onChange={(s) => setBlockTag(section!, def.tag, s + 12)} />
        </div>
      );
    }
    if (type === ISOLATOR_TYPE && def.name === "Band") {
      return (
        <IsolatorBandControl
          key={def.tag}
          id={id}
          def={def}
          value={value}
          bandLevel={tagValue("C")}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (isAlgorithmMode(def)) {
      return (
        <TrackStateCard
          key={def.tag}
          id={id}
          def={def}
          view={ALGORITHM_MODE_VIEW}
          value={value}
          onChange={(v) => setBlockTag(section!, def.tag, v)}
        />
      );
    }
    if (type === AUTO_RIFF_TYPE) {
      if (def.name === "Phrase" || def.name === "Key") {
        const phrase = def.name === "Phrase";
        const card = (
          <ScrubCard
            key={def.tag}
            id={id}
            def={def}
            value={value}
            min={0}
            max={def.options?.at(-1)?.value ?? 0}
            format={(v) =>
              phrase
                ? { value: String(v + 1).padStart(2, "0"), unit: "Phrase" }
                : keyCardValue(def.options?.find((o) => o.value === v)?.label ?? String(v))
            }
            alert
            color="var(--slot-color)"
            valueIcon={phrase ? "note" : "piano"}
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
        );
        if (!phrase) return card;
        return (
          <div key={def.tag} className="riff-phrase">
            {card}
            <PhraseRoll phrase={value} keyIndex={autoRiff?.key ?? 0} />
          </div>
        );
      }
      if (def.name === "Hold" || def.name === "Loop") {
        return (
          <TrackStateCard
            key={def.tag}
            id={id}
            def={def}
            view={def.name === "Hold" ? AUTO_RIFF_HOLD_VIEW : AUTO_RIFF_LOOP_VIEW}
            value={value}
            onChange={(v) => setBlockTag(section!, def.tag, v)}
          />
        );
      }
    }
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
                      : type === SUSTAINER_TYPE
                        ? SUSTAINER_METERS[def.name]
                        : type === SYNTH_TYPE
                          ? SYNTH_METERS[def.name]
                          : type === STEREO_ENHANCE_TYPE
                            ? STEREO_ENHANCE_METERS[def.name]
                            : type === AUTO_RIFF_TYPE
                              ? AUTO_RIFF_METERS[def.name]
                              : type === SLOW_GEAR_TYPE
                                ? SLOW_GEAR_METERS[def.name]
                                : type === ISOLATOR_TYPE
                                  ? ISOLATOR_METERS[def.name]
                                  : type === PITCH_BEND_TYPE && def.name === "Bend"
                                    ? bendMeterCaption()
                                    : type === ELECTRIC_TYPE
                                      ? ELECTRIC_METERS[def.name]
                                      : type === VOCODER_TYPE
                                        ? VOCODER_METERS[def.name]
                                        : type === DIST_TYPE
                                          ? DIST_METERS[def.name]
                                          : type === OSC_VOC_TYPE || type === OSC_BOT_TYPE
                                            ? OSC_VOC_METERS[def.name]
                                            : type === TAPE_ECHO1_TYPE || type === TAPE_ECHO2_TYPE
                                              ? TAPE_METERS[def.name]
                                            : type === FREEZE_TYPE
                                              ? FREEZE_METERS[def.name]
                                            : type === TWIST_TYPE
                                              ? def.name === "Rise"
                                                ? "Time to full rotation"
                                                : def.name === "Fall"
                                                  ? tagValue("A") === 1
                                                    ? "Fade-out time"
                                                    : "Not used with Release Fall"
                                                  : undefined
                                              : type === ROLL1_TYPE || type === ROLL2_TYPE
                                                ? tagValue("C") === 0
                                                  ? type === ROLL2_TYPE && value >= 100
                                                    ? "Repeats forever (INF)"
                                                    : "Repetitions"
                                                  : "Not used while Roll is on"
                                                : undefined) ?? def.name,
                color: () => "var(--slot-color)",
              }
            : undefined
        }
        balance={
          (type === ROBOT_TYPE || type === ELECTRIC_TYPE || type === HRM_MANUAL_TYPE || type === HRM_AUTO_TYPE) &&
          def.name === "Formant"
            ? FORMANT_BALANCE
            : type === ELECTRIC_TYPE && def.name === "Stability"
              ? STABILITY_BALANCE
              : (type === VOCODER_TYPE || type === OSC_VOC_TYPE || type === OSC_BOT_TYPE || type === DIST_TYPE) &&
                  def.name === "Tone"
                ? TONE_BALANCE
                : (type === VOCODER_TYPE || type === OSC_VOC_TYPE || type === OSC_BOT_TYPE) && def.name === "Mod Sens"
                  ? MOD_SENS_BALANCE
                : type === TAPE_ECHO2_TYPE && def.name === "Bass"
                  ? BASS_BALANCE
                : type === TAPE_ECHO2_TYPE && def.name === "Treble"
                  ? TREBLE_BALANCE
              : grouped && def.name === "Balance"
            ? {
                left: "Direct",
                right:
                  type === LOFI_TYPE
                    ? "Lo-Fi"
                    : type === SYNTH_TYPE
                      ? "Synth"
                      : type === AUTO_RIFF_TYPE
                        ? "Riff"
                        : type === G2B_TYPE
                          ? "Bass"
                          : type === VOCODER_TYPE || type === OSC_VOC_TYPE
                            ? "Vocoder"
                            : type === OSC_BOT_TYPE
                              ? "Oscillator"
                              : type === ROLL1_TYPE || type === ROLL2_TYPE
                                ? "Roll"
                              : type === FREEZE_TYPE
                                ? "Freeze"
                            : "Effect",
              }
            : undefined
        }
        onChange={(v) => setBlockTag(section!, def.tag, v)}
      />
    );
  }

  function bendMeterCaption() {
    const pitchDef = params.find((d) => d.name === "Pitch");
    const oct = pitchDef ? octaveShift(pitchDef, tagValue(pitchDef.tag)) : 0;
    if (oct === 0) return "Pitch is 0: no bend";
    return `Original → ${oct > 0 ? "+" : "−"}${Math.abs(oct)} ${Math.abs(oct) === 1 ? "octave" : "octaves"}`;
  }

  function isShelfGain(def: (typeof params)[number]) {
    return type === SUSTAINER_TYPE && (def.name === "Low Gain" || def.name === "Hi Gain");
  }

  function control(def: (typeof params)[number]) {
    const sequenced = def.tag === sequencedTag;
    return (
      <div
        key={def.tag}
        className={`ifx-control${sequenced ? " is-sequenced" : ""}${CUT_PARAM.test(def.name) || isShelfGain(def) || (type === AUTO_RIFF_TYPE && def.name === "Phrase") || (type === ISOLATOR_TYPE && def.name === "Band") || (type === TRANSPOSE_TYPE && def.name === "Trans") || (type === RADIO_TYPE && def.name === "Lo-Fi") || (type === ROBOT_TYPE && (def.name === "Note" || def.name === "Formant")) || (type === ELECTRIC_TYPE && ["Shift", "Scale", "Formant", "Stability"].includes(def.name)) || ((type === HRM_MANUAL_TYPE || type === HRM_AUTO_TYPE) && def.name === "Formant") || ((type === VOCODER_TYPE || type === OSC_VOC_TYPE || type === OSC_BOT_TYPE) && (def.name === "Tone" || def.name === "Mod Sens")) || (type === OSC_VOC_TYPE && def.name === "Carrier") || (type === OSC_BOT_TYPE && (def.name === "Wave" || def.name === "Note")) || (type === OCTAVE_TYPE && def.name === "Octave") || (type === TAPE_ECHO2_TYPE && (def.name === "Bass" || def.name === "Treble")) || ((type === ROLL1_TYPE || type === ROLL2_TYPE) && def.name === "Roll") || ((type === HRM_MANUAL_TYPE || type === HRM_AUTO_TYPE) && def.name === "Voice") ? " is-wide" : ""}${(type === ELECTRIC_TYPE && def.name === "Scale") || ((type === HRM_MANUAL_TYPE || type === HRM_AUTO_TYPE) && def.name === "Voice") ? " is-wider" : ""}${(type === DIST_TYPE && def.name === "Type") || ((type === HRM_MANUAL_TYPE || type === HRM_AUTO_TYPE) && def.name === "Pan") || def.format === "pan" ? " is-full" : ""}${def.format === "sec10" || def.format === "ms" ? " has-unit" : ""}`}
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
          synth={synth}
          isolator={isolator}
          transpose={transpose}
          pitchBend={pitchBend}
          oscBot={oscBot}
          octave={octave}
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
      {eqFx ? (
        <EqPreviewBar
          key={`eq-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={eqFx}
        />
      ) : null}
      {freeze ? (
        <FreezePreviewBar
          key={`freeze-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={freeze}
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
      {sustainer ? (
        <SustainerPreviewBar
          key={`sustainer-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={sustainer}
        />
      ) : null}
      {g2b ? (
        <G2bPreviewBar
          key={`g2b-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={g2b}
        />
      ) : null}
      {slowGear ? (
        <SlowGearPreviewBar
          key={`slowgear-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={slowGear}
        />
      ) : null}
      {autoRiff ? (
        <AutoRiffPreviewBar
          key={`autoriff-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={autoRiff}
        />
      ) : null}
      {vocoder ? (
        <VocoderPreviewBar
          key={`vocoder-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={vocoder}
        />
      ) : null}
      {oscVocoder ? (
        <VocoderPreviewBar
          key={`oscvoc-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={oscVocoder}
        />
      ) : null}
      {warp ? (
        <WarpPreviewBar
          key={`warp-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={warp}
        />
      ) : null}
      {roll ? (
        <RollPreviewBar
          key={`roll-${bank}-${slot}-${type}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={roll}
        />
      ) : null}
      {twist ? (
        <TwistPreviewBar
          key={`twist-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={twist}
        />
      ) : null}
      {dist ? (
        <DistPreviewBar
          key={`dist-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={dist}
        />
      ) : null}
      {harmony ? (
        <HarmonyPreviewBar
          key={`harmony-${bank}-${slot}-${harmony.kind}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={harmony}
        />
      ) : null}
      {electric ? (
        <ElectricPreviewBar
          key={`electric-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={electric}
        />
      ) : null}
      {robot ? (
        <RobotPreviewBar
          key={`robot-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={robot}
        />
      ) : null}
      {radio ? (
        <RadioPreviewBar
          key={`radio-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={radio}
        />
      ) : null}
      {lofi ? (
        <LofiPreviewBar
          key={`lofi-${bank}-${slot}`}
          slot={FX_BANKS[slot]!}
          initialBpm={memoryTempo(model) ?? DEFAULT_BPM}
          memoryBpm={memoryTempo(model)}
          settings={lofi}
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
              <div className="ifx-group-grid">
                {freeze ? <FreezeEnvelope {...freeze} /> : null}
                {eqFx ? (
                  <div className="ifx-eq">
                    <EqCurve settings={eqFx} />
                    <EqFaderBoard
                      idPrefix={`ifx-edit-${section}`}
                      params={params}
                      switchTag=""
                      tags={tags}
                      bands={EQ_FX_BANDS}
                      onChange={(tag, v) => setBlockTag(section!, tag, v)}
                    />
                  </div>
                ) : null}
                {eqFx ? null : (freeze
                  ? [...mainParams].sort((a, b) => FREEZE_ORDER.indexOf(a.name) - FREEZE_ORDER.indexOf(b.name))
                  : mainParams
                ).map(control)}
              </div>
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
