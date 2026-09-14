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

const FILTER_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 3, "Sets the rate of modulation."),
  intP("B", "Depth", 0, 100, 50, "Sets the depth of modulation."),
  intP("C", "Resonance", 0, 100, 50, "Sets the intensity of the effect."),
  intP("D", "Cutoff", 0, 100, 50, "Sets the cutoff frequency of the filter."),
  boolP("E", "Filter E", 0, "Additional filter setting stored with this effect."),
];

const PHASER_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 3, "Sets the speed of the effect."),
  intP("B", "Depth", 0, 100, 50, "Sets the richness of the effect."),
  intP("C", "Resonance", 0, 100, 50, "Sets the intensity of the effect."),
  intP("D", "Manual", 0, 100, 50, "Sets the center frequency of the phaser effect."),
  intP("E", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
  intP("F", "E.Level", 0, 100, 100, "Sets the volume level of the effect sound."),
  intP("G", "Mode", 0, 100, 0, "Additional phaser setting."),
  boolP("H", "Bi-Phase", 1, "Additional phaser mode stored with this effect."),
];

const FLANGER_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 2, "Sets the speed of the effect."),
  intP("B", "Depth", 0, 100, 50, "Sets the richness of the effect."),
  intP("C", "Resonance", 0, 100, 70, "Sets the intensity of the effect."),
  intP("D", "Manual", 0, 100, 50, "Sets the center frequency of the flanger effect."),
  intP("E", "Separation", 0, 100, 0, "Sets the amount of separation (how wide the sound seems)."),
  intP("F", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
  intP("G", "E.Level", 0, 100, 100, "Sets the volume of the effect sound."),
  intP("H", "Mode", 0, 100, 0, "Additional flanger setting."),
];

const SYNTH_PARAMS: ParamDef[] = [
  intP("A", "Frequency", 0, 100, 50, "Sets the frequency of the filter."),
  intP("B", "Resonance", 0, 100, 50, "Sets the intensity of the effect."),
  intP("C", "Decay", 0, 100, 50, "Sets the time over which the filter frequency will change."),
  intP("D", "Balance", 0, 100, 50, "Volume balance between the direct sound and the synth sound."),
];

const LOFI_BIT: EnumOption[] = [{ value: 0, label: "OFF" }];
for (let b = 1; b <= 31; b++) LOFI_BIT.push({ value: b, label: String(b) });

const LOFI_PARAMS: ParamDef[] = [
  enumP("A", "Bit Depth", LOFI_BIT, 24, "Sets the bit depth. When OFF, sound quality is not degraded."),
  enumP(
    "B",
    "Sample Rate",
    opts("OFF", "1/2", "1/3", "1/4", "1/5", "1/6", "1/8", "1/12", "1/16", "1/24", "1/32"),
    3,
    "Sets the sampling rate.",
  ),
  intP("D", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
];

const RADIO_PARAMS: ParamDef[] = [
  intP("A", "Lo-Fi", 1, 10, 4, "Sets the amount of blurring."),
  intP("B", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const RING_MOD_PARAMS: ParamDef[] = [
  intP("A", "Frequency", 0, 100, 50, "Sets the frequency of the internal oscillator."),
  intP("B", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
  boolP("C", "Mode", 1, "Additional ring modulator setting."),
];

const G2B_PARAMS: ParamDef[] = [
  intP("A", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
  boolP("B", "Mode", 1, "Additional G2B setting."),
];

const SUSTAINER_PARAMS: ParamDef[] = [
  intP("A", "Attack", 0, 100, 50, "Sets the strength of the attack when picking."),
  intP("B", "Release", 0, 100, 50, "Range over which signals are adjusted. Larger values give longer sustain."),
  intP("C", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
  intP("D", "Lo Gain", 0, 40, 20, "Gain for the low frequency range (−20–0–+20 dB).", "db"),
  intP("E", "Hi Gain", 0, 40, 20, "Gain for the high frequency range (−20–0–+20 dB).", "db"),
  intP("F", "Sustain", 0, 100, 50, "Sets the sustain time."),
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
  boolP("C", "Hold", 0, "When ON, the effect sound continues after there is no input signal."),
  intP("D", "Attack", 0, 100, 50, "Loudness of the attack sound added to each phrase."),
  boolP("E", "Loop", 1, "When ON, the phrase plays back continuously."),
  enumP("F", "Key", KEY_OPTIONS, 0, "Sets the key of the phrase."),
  intP("G", "Balance", 0, 100, 50, "Volume balance between the direct sound and the effect sound."),
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
  enumP("A", "Rate", SYNC_RATE, 64, "Sets the rate of change in the pan position."),
  intP("B", "Waveform", 0, 100, 50, "How the volume level changes. Higher values create more abrupt change."),
  intP("C", "Depth", 0, 100, 50, "Sets the depth by which pan will change."),
  intP("D", "Init Phase", 0, 180, 0, "Rotational angle of the phase from center when the effect turns on."),
  intP("E", "Mode", 0, 100, 0, "Additional Auto Pan setting."),
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
  enumP("A", "Rate", SYNC_RATE, 99, "Sets the frequency (speed) of the change."),
  intP("B", "Depth", 0, 100, 50, "Sets the depth of the effect."),
  intP("C", "Waveform", 0, 100, 50, "How the volume level changes. Higher values create more abrupt change."),
  intP("D", "Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

const VIBRATO_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 64, "Sets the rate of the vibrato."),
  intP("B", "Depth", 0, 100, 50, "Sets the depth of the vibrato."),
  intP("C", "Color", 0, 100, 50, "Higher settings produce more complex modulation."),
  intP("D", "D.Level", 0, 100, 0, "Sets the volume of the direct sound."),
  intP("E", "E.Level", 0, 100, 100, "Sets the volume of the effect sound."),
];

const PATTERN_SLICER_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 6, "Sets the rate at which the sound will be cut."),
  intP("B", "Duty", 1, 99, 49, "Length of the sound for the slice pattern."),
  intP("C", "Attack", 0, 100, 35, "Attack volume of the slice pattern."),
  enumP(
    "D",
    "Pattern",
    Array.from({ length: 20 }, (_, i) => ({ value: i, label: `P${String(i + 1).padStart(2, "0")}` })),
    0,
    "Slice pattern used to cut the sound.",
  ),
  intP("E", "Depth", 0, 100, 100, "Depth to which the slice pattern is applied."),
  intP("F", "Mode", 0, 100, 0, "Additional Pattern Slicer setting."),
  intP("G", "Shuffle", 0, 100, 2, "Additional Pattern Slicer setting."),
];

const STEP_SLICER_PARAMS: ParamDef[] = [
  enumP("A", "Rate", SYNC_RATE, 6, "Sets the rate at which the sound will be cut."),
  intP("B", "Step Max", 0, 15, 15, "Maximum number of steps (1–16)."),
  intP("C", "Step Length", 0, 100, 50, "Sets the length of one step."),
  ..."DEFGHIJKLMNOPQRSTUVWXYZ".split("").map((tag, i) =>
    intP(tag, `Step ${i + 1}`, 0, 100, 50, `Volume of step ${i + 1}.`),
  ),
  ..."0123456789".split("").map((tag, i) =>
    intP(tag, `Step ${24 + i}`, 0, 100, tag === "9" ? 0 : 100, `Volume of step ${24 + i}.`),
  ),
  intP("#", "Depth", 0, 100, 6, "Depth to which the slice pattern is applied."),
];

function delayFamilyParams(modDepth = false): ParamDef[] {
  const base: ParamDef[] = [
    enumP("A", "Time", DELAY_TIME, 211, "Sets the delay time."),
    intP("B", "Feedback", 0, 100, 20, "Number / amount of delay repeats."),
  ];
  if (modDepth) {
    base.push(intP("C", "Mod Depth", 0, 100, 50, "Modulation depth of the delay sound."));
    base.push(intP("D", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."));
    base.push(enumP("E", "Lo Cut", LO_CUT, 0, "Frequency at which the low cut filter begins to take effect."));
    base.push(enumP("F", "High Cut", HI_CUT, 29, "Frequency at which the high cut filter begins to take effect."));
    base.push(intP("G", "E.Level", 0, 120, 50, "Sets the volume of the delay sound."));
  } else {
    base.push(intP("C", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."));
    base.push(enumP("D", "Lo Cut", LO_CUT, 0, "Frequency at which the low cut filter begins to take effect."));
    base.push(enumP("E", "High Cut", HI_CUT, 29, "Frequency at which the high cut filter begins to take effect."));
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
  enumP("A", "Rate", [...SYNC_RATE], 64, "Sets the rate of the chorus effect."),
  intP("B", "Depth", 0, 100, 50, "Sets the depth of the chorus effect."),
  intP("C", "D.Level", 0, 100, 0, "Sets the volume of the direct sound."),
  enumP("D", "Lo Cut", LO_CUT, 29, "Frequency at which the low cut filter begins to take effect."),
  intP("E", "High Cut", 0, 100, 100, "Frequency at which the high cut filter begins to take effect (FLAT at high values)."),
  intP("F", "E.Level", 0, 100, 50, "Sets the volume of the effect sound."),
];

function reverbParams(timeDef: number, densDef: number): ParamDef[] {
  return [
    intP("A", "Time", 0, 100, timeDef, "Sets the length of the reverberation."),
    enumP("B", "Lo Cut", LO_CUT, 0, "Frequency at which the low cut filter begins to take effect."),
    intP("C", "Density", 0, 100, densDef, "Density of the reverberation."),
    enumP("D", "High Cut", HI_CUT, 0, "Frequency at which the high cut filter begins to take effect."),
    enumP("E", "Pre Delay", LO_CUT, 29, "Pre-delay / tone setting for the reverb."),
    intP("F", "D.Level", 0, 100, 100, "Sets the volume of the direct sound."),
    intP("G", "E.Level", 0, 100, 50, "Sets the volume of the effect sound."),
  ];
}

/** Shared step-sequence parameters (A–F header + G–V step values). */
export const INPUT_FX_SEQ_PARAMS: ParamDef[] = [
  boolP("A", "Sequence", 0, "Turns the FX step sequence on or off."),
  boolP("B", "Step Sync", 0, "Synchronizes step timing to the tempo."),
  boolP("C", "Retrigger", 0, "Retriggers the sequence when the effect is switched on."),
  intP("D", "Mode", 0, 100, 0, "Additional sequence setting."),
  enumP("E", "Step Rate", SYNC_RATE, 6, "Rate of the step sequence."),
  intP("F", "Step Max", 0, 15, 15, "Maximum number of steps (1–16)."),
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
  reverbParams(30, 4),
  reverbParams(30, 50),
  reverbParams(5, 5),
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

export function inputFxDefaultSeqTags(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of INPUT_FX_SEQ_PARAMS) {
    if (def.default !== undefined) out[def.tag] = String(def.default);
  }
  return out;
}
