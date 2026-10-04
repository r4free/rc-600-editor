/**
 * Input FX type → RC0 block catalog (Parameter Guide Input FX/Track FX List + MEMORY*.RC0).
 */
import { EQ_FREQS, FX_BANKS, INPUT_FX_TYPE_OPTIONS, type EnumOption, type ParamDef } from "./params.js";

/** RC0 block suffix per type index (THRU = null). Order matches INPUT_FX_TYPE_OPTIONS. */
export const INPUT_FX_BLOCK_SUFFIX: ReadonlyArray<string | null> = [
  null, // THRU
  "LPF",
  "BPF",
  "HPF",
  "PHASER",
  "FLANGER",
  "SYNTH",
  "LOFI",
  "RADIO",
  "RING_MODULATOR",
  "G2B",
  "SUSTAINER",
  "AUTO_RIFF",
  "SLOW_GEAR",
  "TRANSPOSE",
  "PITCH_BEND",
  "ROBOT",
  "ELECTRIC",
  "HARMONIST_MANUAL",
  "HARMONIST_AUTO",
  "VOCODER",
  "OSC_VOCODER",
  "OSC_BOT",
  "PREAMP",
  "DIST",
  "DYNAMICS",
  "EQ",
  "ISOLATOR",
  "OCTAVE",
  "AUTO_PAN",
  "MANUAL_PAN",
  "STEREO_ENHANCE",
  "TREMOLO",
  "VIBRATO",
  "PATTERN_SLICER",
  "STEP_SLICER",
  "DELAY",
  "PANNING_DELAY",
  "REVERSE_DELAY",
  "MOD_DELAY",
  "TAPE_ECHO",
  "TAPE_ECHO_V505V2",
  "GRANULAR_DELAY",
  "WARP",
  "TWIST",
  "ROLL",
  "ROLL_V505V2",
  "FREEZE",
  "CHORUS",
  "REVERB",
  "GATE_REVERB",
  "REVERSE_REVERB",
];

/** Types that store step-sequence settings in a sibling `*_SEQ` block. */
export const INPUT_FX_SEQ_TYPES = new Set<number>([
  1, 2, 3, 4, 5, 6, 9, 14, 15, 22, 27, 28, 30, 32, 33,
]);

export type InputFxCategory =
  | "Filter"
  | "Modulation"
  | "Pitch"
  | "Vocal"
  | "Amp"
  | "Dynamics"
  | "Slicer"
  | "Delay"
  | "Reverb"
  | "Other";

export const INPUT_FX_CATEGORIES: InputFxCategory[] = [
  "Filter",
  "Modulation",
  "Pitch",
  "Vocal",
  "Amp",
  "Dynamics",
  "Slicer",
  "Delay",
  "Reverb",
  "Other",
];

const CATEGORY_BY_TYPE: InputFxCategory[] = [
  "Other", // THRU
  "Filter",
  "Filter",
  "Filter",
  "Modulation",
  "Modulation",
  "Pitch",
  "Filter",
  "Vocal",
  "Modulation",
  "Pitch",
  "Dynamics",
  "Pitch",
  "Dynamics",
  "Pitch",
  "Pitch",
  "Vocal",
  "Vocal",
  "Vocal",
  "Vocal",
  "Vocal",
  "Vocal",
  "Vocal",
  "Amp",
  "Amp",
  "Dynamics",
  "Dynamics",
  "Filter",
  "Pitch",
  "Modulation",
  "Modulation",
  "Modulation",
  "Modulation",
  "Modulation",
  "Slicer",
  "Slicer",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Delay",
  "Modulation",
  "Reverb",
  "Reverb",
  "Reverb",
];

export function inputFxCategory(type: number): InputFxCategory {
  return CATEGORY_BY_TYPE[type] ?? "Other";
}

export function inputFxTypeLabel(type: number): string {
  return INPUT_FX_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? `Type ${type}`;
}

export function inputFxBlockName(type: number): string | null {
  if (type < 0 || type >= INPUT_FX_BLOCK_SUFFIX.length) return null;
  return INPUT_FX_BLOCK_SUFFIX[type] ?? null;
}

export function inputFxSection(bank: number, slot: number, type: number): string | null {
  const block = inputFxBlockName(type);
  if (!block) return null;
  return `${FX_BANKS[bank]!}${FX_BANKS[slot]!}_${block}`;
}

export function inputFxSeqSection(bank: number, slot: number, type: number): string | null {
  if (!INPUT_FX_SEQ_TYPES.has(type)) return null;
  const block = inputFxBlockName(type);
  if (!block) return null;
  return `${FX_BANKS[bank]!}${FX_BANKS[slot]!}_${block}_SEQ`;
}

/** Letter tags A–Z plus Step Slicer extras 0–9 and #. */
export const FX_BLOCK_TAGS = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  ..."0123456789".split(""),
  "#",
] as const;

function opts(...labels: string[]): EnumOption[] {
  return labels.map((label, value) => ({ value, label }));
}

/** Sync rate: note divisions then 0–100 (common Boss encoding). */
function syncRateOptions(): EnumOption[] {
  const notes = [
    "4MEAS",
    "2MEAS",
    "1MEAS",
    "1/2.",
    "1/2T",
    "1/2",
    "1/4.",
    "1/4T",
    "1/4",
    "1/8.",
    "1/8T",
    "1/8",
    "1/16.",
    "1/16T",
    "1/16",
    "1/32.",
    "1/32T",
    "1/32",
  ];
  const out = opts(...notes);
  for (let i = 0; i <= 100; i++) out.push({ value: notes.length + i, label: String(i) });
  return out;
}

const SYNC_RATE = syncRateOptions();

/** Delay/chorus time: note values then 1–2000 ms (12 note slots → default 200 ms ≈ 211). */
function delayTimeOptions(): EnumOption[] {
  const notes = [
    "1/32",
    "1/16T",
    "1/16",
    "1/8T",
    "1/8",
    "1/4T",
    "1/4",
    "1/2T",
    "1/2",
    "1MEAS",
    "2MEAS",
    "4MEAS",
  ];
  const out = opts(...notes);
  for (let ms = 1; ms <= 2000; ms++) out.push({ value: notes.length - 1 + ms, label: `${ms} ms` });
  return out;
}

const DELAY_TIME = delayTimeOptions();

function loCutOptions(): EnumOption[] {
  const freqs = EQ_FREQS.slice(0, EQ_FREQS.indexOf("12.5 kHz") + 1);
  return [{ value: 0, label: "FLAT" }, ...freqs.map((label, i) => ({ value: i + 1, label }))];
}

function hiCutOptions(): EnumOption[] {
  const from = EQ_FREQS.indexOf("20.0 Hz");
  const to = EQ_FREQS.indexOf("12.5 kHz");
  const freqs = EQ_FREQS.slice(from, to + 1);
  return [...freqs.map((label, i) => ({ value: i, label })), { value: freqs.length, label: "FLAT" }];
}

const LO_CUT = loCutOptions();
const HI_CUT = hiCutOptions();

const KEY_OPTIONS = opts(
  "C (Am)",
  "Db (Bbm)",
  "D (Bm)",
  "Eb (Cm)",
  "E (C#m)",
  "F (Dm)",
  "F# (Ebm)",
  "G (Em)",
  "Ab (Fm)",
  "A (F#m)",
  "Bb (Gm)",
  "B (G#m)",
);
function p(
  tag: string,
  name: string,
  kind: ParamDef["kind"],
  rest: Partial<ParamDef> & { info: string },
): ParamDef {
  return { tag, name, kind, ...rest };
}

function intP(
  tag: string,
  name: string,
  min: number,
  max: number,
  def: number,
  info: string,
  format?: ParamDef["format"],
): ParamDef {
  return p(tag, name, "int", { min, max, default: def, info, format });
}

function enumP(
  tag: string,
  name: string,
  options: EnumOption[],
  def: number,
  info: string,
): ParamDef {
  return p(tag, name, "enum", { options, default: def, info });
}

function boolP(tag: string, name: string, def: number, info: string): ParamDef {
  return p(tag, name, "bool", { default: def, info });
}

/** Stored offset from the minimum: 0 = −30 dB, 30 = 0 dB. */
function compThresholdP(tag: string): ParamDef {
  return enumP(
    tag,
    "Comp Threshold",
    Array.from({ length: 31 }, (_, i) => ({ value: i, label: `${i - 30} dB` })),
    0,
    "Adjust this as appropriate for the input signal. When the input signal level exceeds this threshold level, compression will be applied.",
  );
}

function compGainP(tag: string, def: number): ParamDef {
  return enumP(
    tag,
    "Comp Gain",
    Array.from({ length: 21 }, (_, i) => ({ value: i, label: i === 0 ? "0 dB" : `+${i} dB` })),
    def,
    "Sets the volume of the sound.",
  );
}

/** STEP RATE of an effect (not the FX sequence): OFF, then the sync rates shifted by one. */
function stepRateP(tag: string, info: string): ParamDef {
  return enumP(tag, "Step Rate", [{ value: 0, label: "OFF" }, ...SYNC_RATE.map((o) => ({ value: o.value + 1, label: o.label }))], 0, info);
}

const FILTER_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Rate",
    SYNC_RATE,
    3,
    "Sets the rate of modulation: how fast the filter sweeps up and down on its own. This is not the step sequence's Sequence Rate, which sets how fast the sequence moves to the next step.",
  ),
  intP("B", "Depth", 0, 100, 50, "Sets the depth of modulation: how far the filter sweeps around the Cutoff."),
  intP(
    "C",
    "Resonance",
    0,
    100,
    50,
    "Sets the intensity of the effect: higher values give a sharper, more vocal peak at the cutoff. On BPF it also makes the band narrower.",
  ),
  intP(
    "D",
    "Cutoff",
    0,
    100,
    50,
    "Sets the cutoff frequency of the filter: the center the sweep moves around. On BPF it is the center of the band that passes.",
  ),
  stepRateP(
    "E",
    "Sets the rate of the stepped change for the effect: the sweep jumps from value to value at this rate instead of gliding (a sample-and-hold effect). OFF sweeps smoothly. This is part of the filter itself, not the step sequence.",
  ),
];

const PHASER_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Rate",
    SYNC_RATE,
    3,
    "Sets the speed of the effect: how fast the swirl sweeps up and down. This is not the step sequence's Sequence Rate, which sets how fast the sequence moves to the next step.",
  ),
  intP("B", "Depth", 0, 100, 50, "Sets the richness of the effect: how wide the sweep is."),
  intP("C", "Resonance", 0, 100, 50, "Sets the intensity of the effect: higher values give a sharper, more whistling swirl."),
  intP("D", "Manual", 0, 100, 50, "Sets the center frequency of the phaser effect: low values sound darker, high values brighter."),
  intP("E", "D.Level", 0, 100, 100, "Sets the volume of the direct sound. The phaser swirl comes from mixing it with the effect sound."),
  intP("F", "E.Level", 0, 100, 100, "Sets the volume level of the effect sound."),
  intP("G", "Mode", 0, 100, 0, "Additional phaser setting stored with this effect (not described in the Parameter Guide)."),
  boolP("H", "Bi-Phase", 1, "Additional phaser mode stored with this effect (not described in the Parameter Guide)."),
];

const FLANGER_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Rate",
    SYNC_RATE,
    2,
    "Sets the speed of the effect: how fast the jet-plane whoosh sweeps up and down. This is not the step sequence's Sequence Rate, which sets how fast the sequence moves to the next step.",
  ),
  intP("B", "Depth", 0, 100, 50, "Sets the richness of the effect: how wide the whoosh sweeps."),
  intP("C", "Resonance", 0, 100, 70, "Sets the intensity of the effect: higher values give a more metallic, ringing whoosh."),
  intP("D", "Manual", 0, 100, 50, "Sets the center frequency of the flanger effect: low values sound darker, high values brighter."),
  intP("E", "Separation", 0, 100, 0, "Sets the amount of separation: higher values spread the effect between left and right for a wider sound."),
  intP("F", "D.Level", 0, 100, 100, "Sets the volume of the direct sound. The flanger whoosh comes from mixing it with the effect sound."),
  intP("G", "E.Level", 0, 100, 100, "Sets the volume of the effect sound."),
  intP("H", "Mode", 0, 100, 0, "Additional flanger setting stored with this effect (not described in the Parameter Guide)."),
];

const SYNTH_PARAMS: ParamDef[] = [
  intP("A", "Frequency", 0, 100, 50, "Sets the frequency of the filter: low values sound darker, high values brighter."),
  intP("B", "Resonance", 0, 100, 50, "Sets the intensity of the effect: higher values give a sharper, more vocal filter peak."),
  intP(
    "C",
    "Decay",
    0,
    100,
    50,
    "Sets the time over which the filter frequency will change: short values sound plucky, long values give a slow wah-like sweep.",
  ),
  intP("D", "Balance", 0, 100, 50, "Adjusts the volume balance between the direct sound and the synth sound."),
];

/** OFF, then 31 bits down to 1 bit (raw 24 = 8 bits). */
const LOFI_BIT: EnumOption[] = [{ value: 0, label: "OFF" }];
for (let v = 1; v <= 31; v++) LOFI_BIT.push({ value: v, label: String(32 - v) });

/** OFF, then 1/2 down to 1/32 of the sampling rate (raw 3 = 1/4). */
const LOFI_SAMPLE_RATE: EnumOption[] = [{ value: 0, label: "OFF" }];
for (let v = 1; v <= 31; v++) LOFI_SAMPLE_RATE.push({ value: v, label: `1/${v + 1}` });

const LOFI_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Bit Depth",
    LOFI_BIT,
    24,
    "Sets the bit depth. When this is OFF, the sound quality is not degraded. Fewer bits give a grainier, noisier, more crushed sound.",
  ),
  enumP(
    "B",
    "Sample Rate",
    LOFI_SAMPLE_RATE,
    3,
    "Sets the sampling rate. When this is OFF, the sound quality is not degraded. Lower fractions (toward 1/32) lose more highs and add a metallic, aliased edge.",
  ),
  intP("D", "Balance", 0, 100, 50, "Adjusts the volume balance between the direct sound and the effect sound."),
];

const RADIO_PARAMS: ParamDef[] = [
  intP("A", "Lo-Fi", 1, 10, 4, "Sets the amount of blurring."),
  intP("B", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const RING_MOD_PARAMS: ParamDef[] = [
  intP(
    "A",
    "Frequency",
    0,
    100,
    50,
    "Sets the frequency of the internal oscillator that multiplies the sound. Low values give a fast wobble; high values a metallic, bell-like tone. When the step sequence is on and its Target is Frequency, each step sets it instead.",
  ),
  intP(
    "B",
    "Balance",
    0,
    100,
    50,
    "Adjusts the volume balance between the direct sound (0) and the effect sound (100).",
  ),
  boolP("C", "Mode", 1, "Additional ring modulator setting stored with this effect (not described in the Parameter Guide)."),
];

const G2B_PARAMS: ParamDef[] = [
  intP("A", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
  boolP("B", "Mode", 1, "Additional G2B setting."),
];

const SUSTAINER_PARAMS: ParamDef[] = [
  intP(
    "A",
    "Attack",
    0,
    100,
    50,
    "Sets the strength of the attack when picking: higher values let more of each pick's initial snap through.",
  ),
  intP(
    "B",
    "Release",
    0,
    100,
    50,
    "Sets the range (time) over which signals are adjusted to a certain volume. Larger values result in longer sustain.",
  ),
  intP("C", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
  intP("D", "Low Gain", 0, 40, 20, "Sets the gain for the low frequency range (−20–0–+20 dB).", "db"),
  intP("E", "Hi Gain", 0, 40, 20, "Sets the gain for the high frequency range (−20–0–+20 dB).", "db"),
  intP(
    "F",
    "Sustain",
    0,
    100,
    50,
    "Sets the sustain time: how long a note keeps ringing at an even volume before it fades.",
  ),
];

const AUTO_RIFF_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Phrase",
    Array.from({ length: 30 }, (_, i) => ({ value: i, label: `P${i + 1}` })),
    0,
    "Selects the phrase for creating the auto riff.",
  ),
  enumP("B", "Tempo", SYNC_RATE, 6, "Sets the speed of the phrase."),
  boolP(
    "C",
    "Hold",
    0,
    "If you turn Hold ON after you pick a note, the effect sound continues even after there is no input signal.",
  ),
  intP("D", "Attack", 0, 100, 50, "Sets the loudness of the attack sound added to each phrase."),
  boolP("E", "Loop", 1, "If Loop is ON, the phrase is played back continuously. OFF plays it once."),
  enumP("F", "Key", KEY_OPTIONS, 0, "Sets the key of the phrase (major key with its relative minor)."),
  intP("G", "Balance", 0, 100, 50, "Adjusts the volume balance between the direct sound and the effect sound."),
];

const SLOW_GEAR_PARAMS: ParamDef[] = [
  intP("A", "Sens", 0, 100, 50, "Sets the effect’s sensitivity when you’re picking."),
  intP("B", "Rise Time", 0, 100, 50, "Time for the volume to reach maximum from the moment you begin picking."),
  intP("C", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
  boolP("D", "Mode", 1, "Additional Slow Gear setting."),
];

const TRANSPOSE_PARAMS: ParamDef[] = [
  intP("A", "Trans", 0, 24, 12, "Amount of transposition in semitones when the FX is on (−12–0–+12).", "bipolar12"),
  boolP("B", "Mode", 1, "Additional Transpose setting."),
];

const PITCH_BEND_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Pitch",
    opts("-3OCT", "-2OCT", "-1OCT", "0", "+1OCT", "+2OCT", "+3OCT", "+4OCT"),
    6,
    "Sets the amount of pitch shift in octave steps.",
  ),
  intP("B", "Bend", 0, 100, 50, "Amount of bend within the range specified by Pitch."),
  boolP("C", "Mode", 1, "Additional Pitch Bend setting."),
];

const ROBOT_PARAMS: ParamDef[] = [
  enumP("A", "Note", opts("C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"), 0, "Fixed pitch for the robot voice."),
  intP("B", "Formant", 0, 100, 50, "Negative settings sound more masculine; positive more feminine.", "bipolar50"),
  boolP("C", "Mode", 1, "Additional Robot setting."),
];

const ELECTRIC_PARAMS: ParamDef[] = [
  intP("A", "Shift", 0, 24, 12, "How much the pitch changes (−12–0–+12).", "bipolar12"),
  intP("B", "Formant", 0, 100, 50, "Negative settings sound more masculine; positive more feminine.", "bipolar50"),
  intP("C", "Speed", 0, 10, 5, "How quickly the pitch changes."),
  intP("D", "Stability", 0, 20, 10, "How easily the pitch changes. Larger values are more stable.", "bipolar20"),
  enumP(
    "E",
    "Scale",
    [{ value: 0, label: "CHROMATIC" }, ...KEY_OPTIONS.map((o) => ({ value: o.value + 1, label: o.label }))],
    0,
    "How the pitch is adjusted.",
  ),
];

const HRM_VOICE = opts(
  "OCT-",
  "OCT+",
  "-6TH",
  "-5TH",
  "-4TH",
  "-3RD",
  "+3RD",
  "+4TH",
  "+5TH",
  "+6TH",
  "UNISON",
);

const HRM_MANUAL_PARAMS: ParamDef[] = [
  enumP("A", "Voice", HRM_VOICE, 6, "Selects the type of harmony."),
  intP("B", "Formant", 0, 100, 50, "Adjusts the vocal character of the harmony part.", "bipolar50"),
  intP("C", "Pan", 0, 100, 50, "Sets the panning of the harmony part.", "pan"),
  enumP("D", "Key", KEY_OPTIONS, 0, "Sets the key used when adding harmony."),
  intP("E", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
  intP("F", "Hrm Level", 0, 100, 80, "Sets the volume of the harmony sound."),
];

const HRM_AUTO_PARAMS: ParamDef[] = [
  enumP("A", "Voice", opts("OCT-", "OCT+", "LOWER", "LOW", "HIGH", "HIGHER", "UNISON"), 4, "Selects the type of harmony."),
  intP("B", "Formant", 0, 100, 50, "Adjusts the vocal character of the harmony part.", "bipolar50"),
  intP("C", "Pan", 0, 100, 50, "Adjusts the panning of the harmony part.", "pan"),
  enumP("D", "Hrm Mode", opts("HYBRID", "AUTO"), 1, "Data used when creating harmonies."),
  enumP("E", "Key", KEY_OPTIONS, 0, "Sets the key used when adding harmony."),
  intP("F", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
  intP("G", "Hrm Level", 0, 100, 80, "Sets the volume of the harmony sound."),
];

const VOCODER_CARRIER = opts(
  "MIC1",
  "MIC2",
  "INST1-L",
  "INST1-R",
  "INST2-L",
  "INST2-R",
  "TRACK1",
  "TRACK2",
  "TRACK3",
  "TRACK4",
  "TRACK5",
  "TRACK6",
);

const VOCODER_PARAMS: ParamDef[] = [
  enumP("A", "Carrier", VOCODER_CARRIER, 6, "Input or track used as the basis (carrier) of the vocoder sound."),
  intP("B", "Tone", 0, 100, 50, "Adjusts the tonal character of the vocoder part.", "bipolar50"),
  intP("C", "Attack", 0, 100, 50, "Sets the attack of the sound."),
  intP("D", "Mod Sens", 0, 100, 50, "Sensitivity by which the audio input controls the modulation.", "bipolar50"),
  intP("E", "Balance", 0, 100, 50, "Volume balance between the direct sound and the vocoder sound."),
  boolP("F", "Mode", 1, "Additional Vocoder setting."),
];

const OSC_WAVE = opts("SAW", "VINTAGE SAW", "DETUNE SAW", "SQUARE", "RECT");

const OSC_VOC_PARAMS: ParamDef[] = [
  enumP("A", "Carrier", OSC_WAVE, 0, "Selects the carrier waveform (the basic sound)."),
  intP("B", "Tone", 0, 100, 50, "Adjusts the tonal character of the vocoder part.", "bipolar50"),
  intP("C", "Attack", 0, 100, 50, "Sets the attack of the sound."),
  enumP("D", "Octave", opts("-2OCT", "-1OCT", "0", "+1OCT"), 2, "Sets the pitch of the sound."),
  intP("E", "Mod Sens", 0, 100, 50, "Sensitivity by which the audio input controls the modulation.", "bipolar50"),
  intP("F", "Release", 0, 100, 50, "Decay time for sound initiated by a note message."),
  intP("G", "Balance", 0, 100, 50, "Volume balance between the direct sound and the vocoder sound."),
];

const OSC_BOT_PARAMS: ParamDef[] = [
  enumP("A", "Wave", OSC_WAVE, 0, "Selects the oscillator waveform."),
  intP("B", "Tone", 0, 100, 50, "Adjusts the tonal character of the oscillator.", "bipolar50"),
  intP("C", "Attack", 0, 100, 50, "Sets the attack of the sound."),
  intP("D", "Note", 0, 100, 12, "Note used to make the oscillator sound (C1–G9 range)."),
  intP("E", "Mod Sens", 0, 100, 50, "Sensitivity by which the audio input controls the modulation.", "bipolar50"),
  intP("F", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
];

const PREAMP_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Amp Type",
    opts(
      "JC-120",
      "NATURAL CLEAN",
      "FULL RANGE",
      "COMBO CRUNCH",
      "STACK CRUNCH",
      "HIGAIN STACK",
      "POWER DRIVE",
      "EXTREM LEAD",
      "CORE METAL",
    ),
    3,
    "Selects the preamp type.",
  ),
  enumP(
    "B",
    "Spk Type",
    opts("OFF", "ORIGINAL", "1x8\"", "1x10\"", "1x12\"", "2x12\"", "4x10\"", "4x12\"", "8x12\""),
    1,
    "Selects the speaker type.",
  ),
  intP("C", "Gain", 0, 120, 50, "Sets the distortion of the amp."),
  intP("D", "T-Comp", 0, 20, 10, "Sense of compression of the amp.", "bipolar20"),
  intP("E", "Bass", 0, 100, 50, "Tone for the low frequency range."),
  intP("F", "Middle", 0, 100, 50, "Tone for the middle frequency range."),
  intP("G", "Treble", 0, 100, 50, "Tone for the high frequency range."),
  intP("H", "Presence", 0, 100, 50, "Tone for the ultra high frequency range."),
  enumP("I", "Mic Type", opts("DYN57", "DYN421", "CND451", "CND87", "FLAT"), 0, "Selects the mic type."),
  enumP("J", "Mic Dis", opts("OFF MIC", "ON MIC"), 0, "Distance between the mic and speaker."),
  intP("K", "Mic Pos", 0, 10, 0, "Mic position (CENTER, then 1–10 cm)."),
  intP("L", "E.Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const DIST_PARAMS: ParamDef[] = [
  enumP("A", "Type", opts("VOCAL", "BOOST", "OD", "DS", "METAL", "FUZZ"), 0, "Selects the distortion type."),
  intP("B", "Tone", 0, 100, 50, "Sets the tonal character.", "bipolar50"),
  intP("C", "Dist", 0, 100, 50, "Sets the degree of distortion."),
  intP("D", "D.Level", 0, 100, 50, "Sets the volume of the direct sound."),
  intP("E", "E.Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const DYNAMICS_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Type",
    opts(
      "NATURAL COMP",
      "MIXER COMP",
      "LIVE COMP",
      "NATURAL LIM",
      "HARD LIM",
      "JINGL COMP",
      "HARD COMP",
      "SOFT COMP",
      "CLEAN COMP",
      "DANCE COMP",
      "ORCH COMP",
      "VOCAL COMP",
      "ACOUSTIC",
      "ROCK BAND",
      "ORCHESTRA",
      "LOW BOOST",
      "BRIGHTEN",
      "DJs VOICE",
      "PHONE VOX",
    ),
    0,
    "Selects the type of the DYNAMICS effect.",
  ),
  intP("B", "Dynamics", 0, 40, 20, "Amount of difference between soft and loud (−20–0–+20).", "bipolar20"),
];

const FX_EQ_PARAMS: ParamDef[] = [
  intP("A", "Lo", 0, 40, 20, "Low frequency range tone (−20–0–+20 dB).", "db"),
  intP("B", "Lo-Mid", 0, 40, 20, "Low-middle frequency range tone (−20–0–+20 dB).", "db"),
  intP("C", "Hi-Mid", 0, 40, 20, "High-middle frequency range tone (−20–0–+20 dB).", "db"),
  intP("D", "High", 0, 40, 20, "High frequency range tone (−20–0–+20 dB).", "db"),
  intP("E", "Level", 0, 100, 20, "Overall volume of the equalizer."),
  enumP("F", "Lo Cut", LO_CUT, 16, "Frequency at which the low cut filter begins to take effect."),
  enumP("G", "High Cut", HI_CUT, 1, "Frequency at which the high cut filter begins to take effect."),
  intP("H", "Enhance", 0, 100, 22, "Adjusts the depth of enhance."),
  intP("I", "Mode", 0, 100, 1, "Additional EQ setting."),
];

const ISOLATOR_PARAMS: ParamDef[] = [
  enumP("A", "Band", opts("LOW", "MIDDLE", "HIGH"), 0, "Range (LOW, MID, HIGH) that will be cut."),
  enumP("B", "Rate", SYNC_RATE, 6, "Sets the rate of modulation."),
  intP("C", "Band Level", 0, 100, 50, "Sets the amount of cut."),
  intP("D", "Depth", 0, 100, 100, "Sets the depth of modulation."),
  intP("E", "Mode", 0, 100, 0, "Additional Isolator setting."),
  intP("F", "Filter", 0, 100, 0, "Additional Isolator setting."),
];

const OCTAVE_PARAMS: ParamDef[] = [
  enumP("A", "Mode", opts("-1OCT", "-2OCT", "-1OCT&-2OCT"), 0, "Selects the octave that will be sounded."),
  intP("B", "Oct.Level", 0, 100, 50, "Sets the volume level of the octave sound."),
  boolP("C", "Switch", 1, "Additional Octave setting."),
];

const AUTO_PAN_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 64, "Sets the rate of change in the pan position: how fast the sound moves between left and right."),
  intP(
    "B",
    "Waveform",
    0,
    100,
    50,
    "Sets the curve of the movement: low values glide smoothly between left and right, high values jump more abruptly from side to side.",
  ),
  intP("C", "Depth", 0, 100, 50, "Sets the depth by which pan will change: how far the sound travels to the left and right."),
  intP(
    "D",
    "Init Phase",
    0,
    180,
    0,
    "Sets where the movement starts when the effect is turned on: 0° starts in the center, 90° starts fully to one side, 180° starts in the center moving the other way.",
    "deg",
  ),
  stepRateP(
    "E",
    "Sets the rate of the stepped change: the pan jumps to a new position at this rate instead of gliding. OFF glides smoothly.",
  ),
];

const MANUAL_PAN_PARAMS: ParamDef[] = [
  intP("A", "Position", 0, 100, 50, "Sets the pan.", "pan"),
];

const STEREO_ENHANCE_PARAMS: ParamDef[] = [
  intP("A", "Enhance", 0, 100, 0, "Adjusts the depth of enhance."),
  enumP("B", "Low Cut", LO_CUT, 29, "Frequency at which the low cut filter begins to take effect."),
  intP("C", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const TREMOLO_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Rate",
    SYNC_RATE,
    99,
    "Sets the frequency (speed) of the change: how fast the volume pulses. This is not the step sequence's Sequence Rate, which sets how fast the sequence moves to the next step.",
  ),
  intP("B", "Depth", 0, 100, 50, "Sets the depth of the effect: how far the volume dips on each pulse."),
  intP(
    "C",
    "Waveform",
    0,
    100,
    50,
    "How the volume level changes. Low values give a smooth, wavy pulse; higher values create a more abrupt, choppy on/off change.",
  ),
  intP("D", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const VIBRATO_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Rate",
    SYNC_RATE,
    64,
    "Sets the rate of the vibrato: how fast the pitch moves up and down. This is not the step sequence's Sequence Rate, which sets how fast the sequence moves to the next step.",
  ),
  intP(
    "B",
    "Depth",
    0,
    100,
    50,
    "Sets the depth of the vibrato: how far the pitch swings. When the step sequence is on and its Target is Depth, each step sets the depth instead.",
  ),
  intP("C", "Color", 0, 100, 50, "Higher settings produce more complex modulation (a less regular wobble)."),
  intP("D", "D.Level", 0, 100, 0, "Sets the volume of the direct sound (without vibrato). Mixing it with E.Level gives a chorus-like sound."),
  intP("E", "E.Level", 0, 100, 100, "Sets the volume of the effect sound (with vibrato)."),
];

const PATTERN_SLICER_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 6, "Sets the rate at which the sound will be cut: the length of each slice (a note value follows the tempo)."),
  intP(
    "B",
    "Duty",
    1,
    99,
    49,
    "Adjusts the length of the sound for the slice pattern: low values give short, staccato slices; high values let each slice ring almost to the next.",
  ),
  intP(
    "C",
    "Attack",
    0,
    100,
    35,
    "Sets the attack volume of the slice pattern: low values fade each slice in softly; high values start each slice hard and accented.",
  ),
  enumP(
    "D",
    "Pattern",
    Array.from({ length: 20 }, (_, i) => ({ value: i, label: `P${String(i + 1).padStart(2, "0")}` })),
    0,
    "Selects the slice pattern that will be used to cut the sound: one of 20 rhythms built into the RC-600.",
  ),
  intP(
    "E",
    "Depth",
    0,
    100,
    100,
    "Adjusts the depth to which the slice pattern is applied: 100 silences the gaps completely; lower values let some sound through between slices.",
  ),
  compThresholdP("F"),
  compGainP("G", 2),
];

const STEP_SLICER_LENGTH_TAGS = "CDEFGHIJKLMNOPQR".split("");
const STEP_SLICER_LEVEL_TAGS = "STUVWXYZ01234567".split("");

const STEP_SLICER_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 6, "Sets the rate at which the sound will be cut."),
  intP("B", "Step Max", 0, 15, 15, "Maximum number of steps (1–16).", "count"),
  ...STEP_SLICER_LENGTH_TAGS.map((tag, i) =>
    intP(tag, `Step ${i + 1} Length`, 0, 100, 50, `Sets the length of step ${i + 1}.`),
  ),
  ...STEP_SLICER_LEVEL_TAGS.map((tag, i) =>
    intP(tag, `Step ${i + 1} Level`, 0, 100, 100, `Sets the volume of step ${i + 1}.`),
  ),
  intP("8", "Depth", 0, 100, 100, "Adjusts the depth to which the slice pattern is applied."),
  compThresholdP("9"),
  compGainP("#", 6),
];

function delayFamilyParams(modDepth = false): ParamDef[] {
  const base: ParamDef[] = [
    enumP(
      "A",
      "Time",
      DELAY_TIME,
      211,
      "Sets the delay time: 1–2000 ms, or a note length that follows the tempo.",
    ),
    intP("B", "Feedback", 0, 100, 20, "Sets the number of delay repeats: higher values repeat longer."),
  ];
  const loCut = (tag: string) =>
    enumP(
      tag,
      "Lo Cut",
      LO_CUT,
      0,
      "Frequency at which the low cut filter begins to take effect on the repeats. FLAT leaves the lows untouched.",
    );
  const hiCut = (tag: string) =>
    enumP(
      tag,
      "High Cut",
      HI_CUT,
      29,
      "Frequency at which the high cut filter begins to take effect on the repeats. FLAT leaves the highs untouched.",
    );
  if (modDepth) {
    base.push(intP("C", "Mod Depth", 0, 100, 50, "Sets the modulation depth of the delay sound."));
    base.push(intP("D", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."));
    base.push(loCut("E"), hiCut("F"));
    base.push(intP("G", "E.Level", 0, 120, 50, "Sets the volume of the delay sound."));
  } else {
    base.push(intP("C", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."));
    base.push(loCut("D"), hiCut("E"));
    base.push(intP("F", "E.Level", 0, 120, 50, "Sets the volume of the delay sound."));
  }
  return base;
}

const TAPE_ECHO_PARAMS: ParamDef[] = [
  enumP("A", "Repeat Rate", DELAY_TIME, 211, "Sets the tape speed."),
  intP("B", "Intensity", 0, 100, 50, "Sets the amount of delay repeats."),
  intP("C", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
  enumP("D", "Lo Cut", LO_CUT, 0, "Frequency at which the low cut filter begins to take effect."),
  enumP("E", "High Cut", HI_CUT, 29, "Frequency at which the high cut filter begins to take effect."),
  intP("F", "E.Level", 0, 120, 50, "Sets the volume of the effect sound."),
];

const TAPE_ECHO2_PARAMS: ParamDef[] = [
  intP("A", "Repeat Rate", 0, 100, 50, "Sets the tape speed."),
  intP("B", "Intensity", 0, 100, 50, "Sets the amount of delay repeats."),
  intP("C", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
  intP("D", "Wow Flutter", 0, 100, 50, "Tape flutter character."),
  intP("E", "Tone", 0, 100, 50, "Tone of the echo repeats."),
  intP("F", "E.Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const GRANULAR_PARAMS: ParamDef[] = [
  intP("A", "Time", 0, 100, 50, "Sets the spacing of the repeats."),
  intP("B", "Feedback", 0, 100, 70, "Sets the length that will be repeated."),
  intP("C", "E.Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const WARP_PARAMS: ParamDef[] = [
  intP("A", "Level", 0, 100, 50, "Adjusts the volume of the effect sound."),
];

const TWIST_PARAMS: ParamDef[] = [
  enumP("A", "Release", opts("FALL", "RELEASE", "FADE"), 0, "How the rotation should stop when the effect is turned off."),
  intP("B", "Rise", 0, 100, 50, "Time for the effect to reach maximum."),
  intP("C", "Fall", 0, 100, 50, "Fade-out time when Release is FADE."),
  intP("D", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const ROLL_PARAMS: ParamDef[] = [
  enumP("A", "Time", SYNC_RATE, 4, "Sets the loop rate."),
  intP("B", "Repeat", 0, 100, 50, "Number of repetitions when Roll is OFF (1–60–100, INF)."),
  enumP("C", "Roll", opts("OFF", "1/2", "1/4", "1/8", "1/16"), 0, "Splits and changes the loop cycle set in Time."),
  intP("D", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
];

const ROLL2_PARAMS: ParamDef[] = [
  enumP("A", "Time", SYNC_RATE, 8, "Sets the loop rate."),
  intP("B", "Repeat", 0, 100, 50, "Number of repetitions when Roll is OFF."),
  enumP("C", "Roll", opts("OFF", "1/2", "1/4", "1/8", "1/16"), 0, "Splits and changes the loop cycle set in Time."),
  intP("D", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
];

const FREEZE_PARAMS: ParamDef[] = [
  intP("A", "Attack", 0, 100, 30, "Fade time until the effect sound is output."),
  intP("B", "Release", 0, 100, 30, "Fade time over which the effect sound disappears."),
  intP("C", "Decay", 0, 100, 30, "Adjusts the decay of the effect sound."),
  intP("D", "Sustain", 0, 100, 30, "Adjusts the sustain of the effect sound."),
  intP("E", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
];

const CHORUS_PARAMS: ParamDef[] = [
  enumP("A", "Rate", [...SYNC_RATE], 64, "Sets the rate of the chorus effect: how fast the shimmer moves."),
  intP("B", "Depth", 0, 100, 50, "Sets the depth of the chorus effect: how strongly the doubled sound is detuned."),
  enumP(
    "C",
    "Lo Cut",
    LO_CUT,
    0,
    "Frequency at which the low cut filter begins to take effect on the chorus sound. FLAT leaves the lows untouched.",
  ),
  enumP(
    "D",
    "High Cut",
    HI_CUT,
    29,
    "Frequency at which the high cut filter begins to take effect on the chorus sound. FLAT leaves the highs untouched.",
  ),
  intP("E", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
  intP("F", "E.Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

function reverbParams(timeDef: number, third: ParamDef): ParamDef[] {
  return [
    intP("A", "Time", 1, 100, timeDef, "Sets the length (time) of reverberation (0.1–10 s).", "sec10"),
    intP("B", "Pre Delay", 0, 500, 0, "Sets the time until the reverb sound appears (0–500 ms).", "ms"),
    third,
    enumP(
      "D",
      "Lo Cut",
      LO_CUT,
      0,
      "Frequency at which the low cut filter begins to take effect on the reverb sound. FLAT leaves the lows untouched.",
    ),
    enumP(
      "E",
      "High Cut",
      HI_CUT,
      29,
      "Frequency at which the high cut filter begins to take effect on the reverb sound. FLAT leaves the highs untouched.",
    ),
    intP("F", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
    intP("G", "E.Level", 0, 100, 50, "Sets the volume of the reverb sound."),
  ];
}

const REVERB_PARAMS = reverbParams(
  30,
  intP("C", "Density", 1, 10, 4, "Sets the density of the reverb sound: low values sound grainy, high values smooth."),
);
const GATE_REVERB_PARAMS = reverbParams(
  30,
  intP(
    "C",
    "Threshold",
    0,
    100,
    50,
    "Sets the level at which the reverberation is cut. The reverberation is cut once its level falls below this setting.",
  ),
);
const REVERSE_REVERB_PARAMS = reverbParams(
  5,
  intP(
    "C",
    "Gate Time",
    1,
    10,
    5,
    "Sets the time at which the reverberations start getting louder (0.1–1 s).",
    "sec10",
  ),
);

/** Shared step-sequence parameters (A–F header + G–V step values). */
export const INPUT_FX_SEQ_PARAMS: ParamDef[] = [
  boolP("A", "Sequence", 0, "Sets the step sequence function on/off. When OFF, the effect ignores the steps."),
  boolP(
    "B",
    "Step Sync",
    0,
    "Sets whether to synchronize loop playback with the step sequence (ON) or not (OFF). When ON, the beginning of the step sequence (step 1) is cued up.",
  ),
  boolP(
    "C",
    "Retrigger",
    0,
    "When ON, turning the effect on with a switch restarts the sequence at step 1, in sync with the start of the loop phrase.",
  ),
  intP("D", "Target", 0, 100, 0, "Sets the parameter that the step sequence changes (depends on the effect)."),
  enumP(
    "E",
    "Sequence Rate",
    SYNC_RATE,
    6,
    "Sets the step's cycle (RATE of the FX sequence): how fast the sequence moves to the next step. This is not the effect's own Rate or Step Rate.",
  ),
  intP("F", "Step Max", 0, 15, 15, "Sets the maximum number of steps (1–16).", "count"),
  ..."GHIJKLMNOPQRSTUV".split("").map((tag, i) =>
    intP(tag, `Step ${i + 1}`, 0, 100, 0, `Value for sequence step ${i + 1}.`),
  ),
];

const TYPE_PARAMS: ParamDef[][] = [
  [], // THRU
  FILTER_PARAMS,
  FILTER_PARAMS,
  FILTER_PARAMS,
  PHASER_PARAMS,
  FLANGER_PARAMS,
  SYNTH_PARAMS,
  LOFI_PARAMS,
  RADIO_PARAMS,
  RING_MOD_PARAMS,
  G2B_PARAMS,
  SUSTAINER_PARAMS,
  AUTO_RIFF_PARAMS,
  SLOW_GEAR_PARAMS,
  TRANSPOSE_PARAMS,
  PITCH_BEND_PARAMS,
  ROBOT_PARAMS,
  ELECTRIC_PARAMS,
  HRM_MANUAL_PARAMS,
  HRM_AUTO_PARAMS,
  VOCODER_PARAMS,
  OSC_VOC_PARAMS,
  OSC_BOT_PARAMS,
  PREAMP_PARAMS,
  DIST_PARAMS,
  DYNAMICS_PARAMS,
  FX_EQ_PARAMS,
  ISOLATOR_PARAMS,
  OCTAVE_PARAMS,
  AUTO_PAN_PARAMS,
  MANUAL_PAN_PARAMS,
  STEREO_ENHANCE_PARAMS,
  TREMOLO_PARAMS,
  VIBRATO_PARAMS,
  PATTERN_SLICER_PARAMS,
  STEP_SLICER_PARAMS,
  delayFamilyParams(false),
  delayFamilyParams(false),
  delayFamilyParams(false),
  delayFamilyParams(true),
  TAPE_ECHO_PARAMS,
  TAPE_ECHO2_PARAMS,
  GRANULAR_PARAMS,
  WARP_PARAMS,
  TWIST_PARAMS,
  ROLL_PARAMS,
  ROLL2_PARAMS,
  FREEZE_PARAMS,
  CHORUS_PARAMS,
  REVERB_PARAMS,
  GATE_REVERB_PARAMS,
  REVERSE_REVERB_PARAMS,
];

export function inputFxTypeParams(type: number): ParamDef[] {
  return TYPE_PARAMS[type] ?? [];
}

export function inputFxDefaultTags(type: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of inputFxTypeParams(type)) {
    if (def.default !== undefined) out[def.tag] = String(def.default);
  }
  return out;
}

/** Type-block tags a step sequence can drive (Parameter Guide ★ marks), in TARGET value order. */
const SEQ_TARGET_TAGS: Record<number, string[]> = {
  1: ["B", "D"],
  2: ["B", "D"],
  3: ["B", "D"],
  4: ["B", "C", "D", "E", "F"],
  5: ["B", "C", "D", "E", "F", "G"],
  6: ["A", "B", "C"],
  9: ["A"],
  14: ["A"],
  15: ["B"],
  22: ["D"],
  27: ["D"],
  28: ["B"],
  30: ["A"],
  32: ["A", "B"],
  33: ["B", "D", "E"],
};

/** Effect parameters the step sequence TARGET can select for this type. */
export function inputFxSeqTargets(type: number): ParamDef[] {
  const params = inputFxTypeParams(type);
  return (SEQ_TARGET_TAGS[type] ?? [])
    .map((tag) => params.find((d) => d.tag === tag))
    .filter((d): d is ParamDef => Boolean(d));
}

/** Sequence block params with TARGET listing this effect's parameters. */
export function inputFxSeqParams(type: number): ParamDef[] {
  const targets = inputFxSeqTargets(type);
  if (targets.length === 0) return INPUT_FX_SEQ_PARAMS;
  const target = enumP(
    "D",
    "Target",
    targets.map((d, value) => ({ value, label: d.name })),
    0,
    "Sets the parameter that the step sequence changes.",
  );
  return INPUT_FX_SEQ_PARAMS.map((d) => (d.tag === "D" ? target : d));
}

export function inputFxDefaultSeqTags(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of INPUT_FX_SEQ_PARAMS) {
    if (def.default !== undefined) out[def.tag] = String(def.default);
  }
  return out;
}

const VIBRATO_TYPE = 33;
const STEP_SLICER_TYPE = 35;
const STEP_COUNT = 16;

/** What a step value shapes in the browser preview (not the real effect). */
export type StepTarget =
  | "volume"
  | "filter"
  | "pitch"
  | "pan"
  | "vibrato"
  | "ring"
  | "phaser"
  | "flanger"
  | "tremolo";

export interface InputFxStepLayout {
  /** `seq`: steps live in the `*_SEQ` block; `block`: in the type block (Step Slicer). */
  source: "seq" | "block";
  /** Always 16 tags; steps past Step Max are inactive. */
  stepTags: string[];
  stepMaxTag: string;
  rateTag: string;
  /** Other sequence settings shown in the sequencer toolbar (same block as the steps). */
  headerTags: string[];
  /** Per-step length lane (Step Slicer only), same order as `stepTags`. */
  lengthTags?: string[];
  /** Extra Step Slicer controls shown inside the sequencer and applied to its preview. */
  previewTags?: {
    depth: string;
    compThreshold: string;
    compGain: string;
  };
  target: StepTarget;
  /** Sequence on/off switch (`seq` source). */
  switchTag?: string;
  /** Step Sync and Retrigger switches (`seq` source). */
  syncTag?: string;
  retriggerTag?: string;
  /** TARGET tag and the preview target for each of its values (`seq` source). */
  targetTag?: string;
  targetPreviews?: StepTarget[];
}

const FILTER_TARGET = new Set([1, 2, 3, 6, 27]);
const PHASER_TYPE = 4;
const FLANGER_TYPE = 5;
const TREMOLO_TYPE = 32;
const RING_MOD_TYPE = 9;
const PITCH_TARGET = new Set([14, 15, 22, 28]);
const PAN_TARGET = new Set([30]);

function stepTarget(type: number, targetName?: string): StepTarget {
  if (targetName && /Level$/.test(targetName)) return "volume";
  if (type === VIBRATO_TYPE) return "vibrato";
  if (type === RING_MOD_TYPE) return "ring";
  if (type === PHASER_TYPE) return "phaser";
  if (type === FLANGER_TYPE) return "flanger";
  if (type === TREMOLO_TYPE) return "tremolo";
  if (FILTER_TARGET.has(type)) return "filter";
  if (PITCH_TARGET.has(type)) return "pitch";
  if (PAN_TARGET.has(type)) return "pan";
  return "volume";
}

export function inputFxStepLayout(type: number): InputFxStepLayout | null {
  if (type === STEP_SLICER_TYPE) {
    return {
      source: "block",
      stepTags: STEP_SLICER_LEVEL_TAGS,
      lengthTags: STEP_SLICER_LENGTH_TAGS,
      stepMaxTag: "B",
      rateTag: "A",
      headerTags: [],
      previewTags: { depth: "8", compThreshold: "9", compGain: "#" },
      target: "volume",
    };
  }
  if (!INPUT_FX_SEQ_TYPES.has(type)) return null;
  return {
    source: "seq",
    stepTags: "GHIJKLMNOPQRSTUV".split("").slice(0, STEP_COUNT),
    stepMaxTag: "F",
    rateTag: "E",
    headerTags: ["A", "B", "C", "D"],
    target: stepTarget(type),
    switchTag: "A",
    syncTag: "B",
    retriggerTag: "C",
    targetTag: "D",
    targetPreviews: inputFxSeqTargets(type).map((d) => stepTarget(type, d.name)),
  };
}

/** Beats per step for a sync-rate note value; `null` for the free 0–100 rate values. */
const SYNC_RATE_BEATS = [
  16, 8, 4, 3, 4 / 3, 2, 1.5, 2 / 3, 1, 0.75, 1 / 3, 0.5, 0.375, 1 / 6, 0.25, 0.1875, 1 / 12, 0.125,
];

export function syncRateBeats(rateIndex: number): number | null {
  return SYNC_RATE_BEATS[rateIndex] ?? null;
}

export function syncRateLabel(rateIndex: number): string {
  return SYNC_RATE.find((o) => o.value === rateIndex)?.label ?? String(rateIndex);
}
