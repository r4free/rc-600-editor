/** Parameter catalog for RC-600 memory/system (from Parameter Guide + RC0 tags). */

export type EnumOption = { value: number; label: string };

export interface ParamDef {
  tag: string;
  name: string;
  kind: "bool" | "int" | "enum";
  min?: number;
  max?: number;
  default?: number;
  options?: EnumOption[];
  /** Parameter Guide text shown by the Info icon. */
  info?: string;
}

export interface TrackInputBit {
  bit: number;
  name: string;
  info: string;
}

/** Per-track INPUT bitmask in TRACK tag Q (MIC1 … RHYTHM). */
export const TRACK_INPUT_BITS: TrackInputBit[] = [
  { bit: 0, name: "MIC 1", info: "Record the MIC 1 input onto this track." },
  { bit: 1, name: "MIC 2", info: "Record the MIC 2 input onto this track." },
  { bit: 2, name: "INST 1 L", info: "Record INST 1 L/MONO onto this track." },
  { bit: 3, name: "INST 1 R", info: "Record INST 1 R onto this track." },
  { bit: 4, name: "INST 2 L", info: "Record INST 2 L/MONO onto this track." },
  { bit: 5, name: "INST 2 R", info: "Record INST 2 R onto this track." },
  { bit: 6, name: "Rhythm", info: "Record the rhythm sound onto this track." },
];

export function bitOn(value: number, bit: number): boolean {
  return ((value >> bit) & 1) === 1;
}

export function setBit(value: number, bit: number, on: boolean): number {
  return on ? value | (1 << bit) : value & ~(1 << bit);
}

export function measureLabel(v: number): string {
  if (v === 0) return "AUTO";
  if (v === 1) return "FREE";
  return String(v);
}

export function measureOptions(): EnumOption[] {
  const opts: EnumOption[] = [
    { value: 0, label: "AUTO" },
    { value: 1, label: "FREE" },
  ];
  for (let i = 2; i <= 32; i++) opts.push({ value: i, label: String(i) });
  return opts;
}

/** FADE TIME: 1/32, 1/16, 1/8, 1/4, then 1–64 measures. Default 2 meas = 5. */
export function fadeTimeOptions(): EnumOption[] {
  const opts: EnumOption[] = [
    { value: 0, label: "1/32" },
    { value: 1, label: "1/16" },
    { value: 2, label: "1/8" },
    { value: 3, label: "1/4" },
  ];
  for (let i = 1; i <= 64; i++) opts.push({ value: i + 3, label: `${i} meas` });
  return opts;
}

export function loopLengthLabel(v: number): string {
  return v === 0 ? "AUTO" : String(v);
}

function trackBitParams(
  name: (n: number) => string,
  info: (n: number) => string,
): TrackInputBit[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    bit: n - 1,
    name: name(n),
    info: info(n),
  }));
}

export const TRACK_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Reverse",
    kind: "bool",
    default: 0,
    info: "Plays the track backwards when ON.",
  },
  {
    tag: "B",
    name: "1 Shot",
    kind: "bool",
    default: 0,
    info: "Plays the phrase once from start to end, then stops. Press REC/PLAY during playback to retrigger. Overdub is not available. Turn Tempo Sync off if you do not want tempo synchronization.",
  },
  {
    tag: "C",
    name: "Pan",
    kind: "int",
    min: 0,
    max: 100,
    default: 50,
    info: "Stereo position of the track (L50–CENTER–R50).",
  },
  {
    tag: "D",
    name: "Play Level",
    kind: "int",
    min: 0,
    max: 200,
    default: 100,
    info: "Playback level of the track (0–200).",
  },
  {
    tag: "E",
    name: "Start Mode",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Immediate" },
      { value: 1, label: "Fade" },
    ],
    info: "Immediate starts playback at once. Fade fades the track in.",
  },
  {
    tag: "F",
    name: "Stop Mode",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Immediate" },
      { value: 1, label: "Fade" },
      { value: 2, label: "Loop End" },
    ],
    info: "Immediate stops at once. Fade fades out. Loop End plays to the end of the loop, then stops.",
  },
  {
    tag: "G",
    name: "Dub Mode",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Overdub" },
      { value: 1, label: "Replace 1" },
      { value: 2, label: "Replace 2" },
    ],
    info: "Overdub layers new material. Replace overwrites the existing take while you record.",
  },
  {
    tag: "H",
    name: "FX",
    kind: "bool",
    default: 1,
    info: "Applies Input FX / Track FX to this track when ON.",
  },
  {
    tag: "I",
    name: "Play Mode",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Multi" },
      { value: 1, label: "Single" },
    ],
    info: "Multi plays all tracks together. Single plays only one track; starting another track stops the current one.",
  },
  {
    tag: "R",
    name: "Measure",
    kind: "enum",
    default: 0,
    options: measureOptions(),
    info: "Loop length when Loop Sync is ON. AUTO matches the first AUTO track you record. FREE follows the recording length. A number sets measures manually.",
  },
  {
    tag: "L",
    name: "Loop Sync",
    kind: "bool",
    default: 1,
    info: "When ON, recording and playback use the memory tempo (or another Loop Sync track). When OFF, the phrase can run at its own length.",
  },
  {
    tag: "S",
    name: "Loop Sync Mode",
    kind: "enum",
    default: 2,
    options: [
      { value: 0, label: "Immediate" },
      { value: 1, label: "Measure" },
      { value: 2, label: "Loop Length" },
    ],
    info: "How Loop Sync aligns record/play. Immediate starts when you press the switch. Measure waits for the next measure. Loop Length follows the LOOP LENGTH setting.",
  },
  {
    tag: "M",
    name: "Tempo Sync",
    kind: "bool",
    default: 1,
    info: "OFF plays at the original recording tempo. ON plays at the memory tempo so tracks 1–6 share one tempo.",
  },
  {
    tag: "N",
    name: "Tempo Sync Mode",
    kind: "enum",
    default: 1,
    options: [
      { value: 0, label: "Pitch" },
      { value: 1, label: "XFade" },
    ],
    info: "When Tempo Sync is ON: Pitch lets pitch follow tempo. XFade keeps pitch and changes playback speed.",
  },
  {
    tag: "O",
    name: "Tempo Sync Speed",
    kind: "enum",
    default: 1,
    options: [
      { value: 0, label: "Half" },
      { value: 1, label: "Normal" },
      { value: 2, label: "Double" },
    ],
    info: "Playback speed for this track: half, original, or double. SPEED CHANGE (Play) sets when the switch takes effect.",
  },
  {
    tag: "P",
    name: "Bounce In",
    kind: "bool",
    default: 0,
    info: "When ON, playback from other tracks is also recorded during record or overdub.",
  },
];

export const REC_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Rec Play Action",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Rec → Dub" },
      { value: 1, label: "Rec → Play" },
    ],
    info: "Order when you press REC/PLAY. Rec → Dub: record, overdub, play. Rec → Play: record, play, overdub.",
  },
  {
    tag: "B",
    name: "Quantize",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "Measure" },
    ],
    info: "Loop Quantize while recording on Loop Sync tracks. Off starts at once (stop still snaps to the measure). Measure waits for the measure start. Ignored during overdub and playback.",
  },
  {
    tag: "C",
    name: "Auto Rec Switch",
    kind: "bool",
    default: 0,
    info: "When ON, REC/PLAY enters standby and recording starts when input exceeds Auto Rec Sens.",
  },
  {
    tag: "D",
    name: "Auto Rec Sens",
    kind: "int",
    min: 1,
    max: 100,
    default: 50,
    info: "Input level that starts Auto Rec (1–100). Used only when Auto Rec Switch is ON.",
  },
  {
    tag: "E",
    name: "Bounce Switch",
    kind: "bool",
    default: 0,
    info: "Enables bounce recording for this memory.",
  },
];

/** Per-track bounce sources in REC tag F (TRACK 1 … TRACK 6). */
export const REC_BOUNCE_TRACK_BITS: TrackInputBit[] = trackBitParams(
  (n) => `Bounce Track ${n}`,
  (n) => `When Bounce Switch is ON, include Track ${n} as a bounce source.`,
);

export const PLAY_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Single Track Change",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Immediate" },
      { value: 1, label: "Loop End" },
    ],
    info: "When Play Mode is Single, when the track switches. Immediate switches at once (or at the next measure if Loop Sync Mode is Measure). Loop End waits until the current loop finishes.",
  },
  {
    tag: "B",
    name: "Fade Time In",
    kind: "enum",
    default: 5,
    options: fadeTimeOptions(),
    info: "Fade-in length when Start Mode is Fade. Note values are shorter than one measure.",
  },
  {
    tag: "C",
    name: "Fade Time Out",
    kind: "enum",
    default: 5,
    options: fadeTimeOptions(),
    info: "Fade-out length when Stop Mode is Fade. Note values are shorter than one measure.",
  },
  {
    tag: "F",
    name: "Loop Length",
    kind: "int",
    min: 0,
    max: 25362,
    default: 0,
    info: "Length that Loop Sync aligns to. AUTO uses the first-recorded phrase. 1–25362 sets the number of measures.",
  },
  {
    tag: "G",
    name: "Speed Change",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Immediate" },
      { value: 1, label: "Loop End" },
    ],
    info: "When Tempo Sync Speed takes effect. Immediate switches at once. Loop End waits until the loop finishes.",
  },
  {
    tag: "H",
    name: "Sync Adjust",
    kind: "enum",
    default: 1,
    options: [
      { value: 0, label: "Beat" },
      { value: 1, label: "Measure" },
    ],
    info: "When Speed Change is Immediate, how far tracks may be out of alignment and still sync. Measure: up to one measure. Beat: up to one beat.",
  },
];

/** All Start track enables in PLAY tag D. */
export const PLAY_ALL_START_BITS: TrackInputBit[] = trackBitParams(
  (n) => `Track ${n}`,
  (n) => `When ON, Track ${n} starts on All Start and when MIDI start is received.`,
);

/** All Stop track enables in PLAY tag E. */
export const PLAY_ALL_STOP_BITS: TrackInputBit[] = trackBitParams(
  (n) => `Track ${n}`,
  (n) => `When ON, Track ${n} stops on All Stop and when MIDI stop is received.`,
);

export const RHYTHM_GENRES: string[] = [
  "Acoustic",
  "Ballad",
  "Blues",
  "Jazz",
  "Fusion",
  "R&B",
  "Soul",
  "Funk",
  "Pop",
  "Soft Rock",
  "Rock",
  "Alt Rock",
  "Punk",
  "Heavy Rock",
  "Metal",
  "Trad",
  "World",
  "Ballroom",
  "Electro",
  "Guide",
  "User",
];

/** Pattern names per genre, from the Parameter Guide Rhythm Pattern List. */
export const RHYTHM_PATTERNS: string[][] = [
  ["Side Stick", "Bossa", "Brush 1", "Brush 2", "Conga 8 Beat", "Conga 16 Beat", "Conga 4 Beat", "Conga Swing", "Conga Bossa", "Cajon 1", "Cajon 2"],
  ["Shuffle 2", "Side Stick 1", "Side Stick 2", "Side Stick 3", "Side Stick 4", "Shuffle 1", "8 Beat", "16 Beat 1", "16 Beat 2", "Swing", "6/8 Beat"],
  ["3 Beat", "12 Bars", "Shuffle 1", "Shuffle 2", "Swing", "6/8 Beat"],
  ["Jazz Blues", "Fast 4 Beat", "Hard Bop", "Brush Bop", "Brush Swing", "Fast Swing", "Med Swing", "Slow Legato", "Jazz Samba", "6/8 Beat"],
  ["16 Beat 1", "16 Beat 2", "16 Beat 3", "16 Beat 4", "16 Beat 5", "16 Beat 6", "16 Beat 7", "Swing", "7/8 Beat"],
  ["Swing 1", "Swing 2", "Swing 3", "Side Stick 1", "Side Stick 2", "Side Stick 3", "Shuffle 1", "Shuffle 2", "8 Beat 1", "16 Beat", "7/8 Beat"],
  ["Swing 1", "Swing 2", "Swing 3", "Swing 4", "16 Beat 1", "16 Beat 2", "16 Beat 3", "Side Stick 1", "Side Stick 2", "Motown", "Percus"],
  ["8 Beat 1", "8 Beat 2", "8 Beat 3", "8 Beat 4", "16 Beat 1", "16 Beat 2", "16 Beat 3", "16 Beat 4", "Swing 1", "Swing 2", "Swing 3"],
  ["8 Beat 1", "8 Beat 2", "16 Beat 1", "16 Beat 2", "Percus 1", "Shuffle 1", "Shuffle 2", "Side Stick 1", "Side Stick 2", "Swing 1", "Swing 2", "Percus 2"],
  ["16 Beat 1", "16 Beat 2", "16 Beat 3", "16 Beat 4", "8 Beat", "Swing 1", "Swing 2", "Swing 3", "Swing 4", "Side Stick 1", "Side Stick 2", "Percus 1", "Percus 2"],
  ["8 Beat 1", "8 Beat 2", "8 Beat 3", "8 Beat 4", "8 Beat 5", "8 Beat 6", "16 Beat 1", "16 Beat 2", "16 Beat 3", "16 Beat 4", "Shuffle 1", "Shuffle 2", "Swing 1", "Swing 2", "Swing 3", "Swing 4"],
  ["Ride Beat", "8 Beat 1", "8 Beat 2", "8 Beat 3", "8 Beat 4", "16 Beat 1", "16 Beat 2", "16 Beat 3", "16 Beat 4", "Swing", "5/4 Beat"],
  ["8 Beat 1", "8 Beat 2", "8 Beat 3", "8 Beat 4", "8 Beat 5", "8 Beat 6", "16 Beat 1", "16 Beat 2", "16 Beat 3", "Side Stick"],
  ["8 Beat 1", "8 Beat 2", "8 Beat 3", "16 Beat 1", "16 Beat 2", "16 Beat 3", "Shuffle 1", "Shuffle 2", "Swing 1", "Swing 2", "Swing 3"],
  ["8 Beat 1", "8 Beat 2", "8 Beat 3", "8 Beat 4", "8 Beat 5", "8 Beat 6", "2xBD 1", "2xBD 2", "2xBD 3", "2xBD 4", "2xBD 5"],
  ["Train 2", "Rock 'n' Roll", "Train 1", "Country 1", "Country 2", "Country 3", "Foxtrot", "Trad 1", "Trad 2"],
  ["Bossa 1", "Bossa 2", "Samba 1", "Samba 2", "Boogaloo", "Merengue", "Reggae", "Latin Rock 1", "Latin Rock 2", "Latin Perc", "Surdo", "Latin 1", "Latin 2"],
  ["Cumbia", "Waltz 1", "Waltz 2", "Cha-Cha", "Beguine", "Rhumba", "Tango 1", "Tango 2", "Jive", "Charleston"],
  ["Electro 01", "Electro 02", "Electro 03", "Electro 04", "Electro 05", "Electro 06", "Electro 07", "Electro 08", "5/4 Beat"],
  [
    "2/4 Triple",
    "3/4",
    "3/4 Triple",
    "4/4",
    "4/4 Triple",
    "BD 8 Beat",
    "BD 16 Beat",
    "BD Shuffle",
    "HH 8 Beat",
    "HH 16 Beat",
    "HH Swing 1",
    "HH Swing 2",
    "8 Beat 1",
    "8 Beat 2",
    "8 Beat 3",
    "8 Beat 4",
    "5/4",
    "5/4 Triple",
    "6/4",
    "6/4 Triple",
    "7/4",
    "7/4 Triple",
    "5/8",
    "6/8",
    "7/8",
    "8/8",
    "9/8",
    "10/8",
    "11/8",
    "12/8",
    "13/8",
    "14/8",
    "15/8",
  ],
  ["Simple Beat"],
];

export function genreOptions(): EnumOption[] {
  return RHYTHM_GENRES.map((label, value) => ({ value, label }));
}

export function rhythmPatternOptions(genre: number): EnumOption[] {
  const names = RHYTHM_PATTERNS[genre] ?? RHYTHM_PATTERNS[0];
  return names.map((label, value) => ({ value, label }));
}

export const RHYTHM_KITS: string[] = [
  "Studio",
  "Live",
  "Light",
  "Heavy",
  "Rock",
  "Metal",
  "Jazz",
  "Brush",
  "Cajon",
  "Drum & Bass",
  "R&B",
  "Dance",
  "Techno",
  "Dance Beats",
  "Hip Hop",
  "808+909",
];

/** BEAT: 2/4–7/4 then 5/8–15/8. Stored 2–7 and 8–18. Default 4/4 = 4. */
export function beatOptions(): EnumOption[] {
  const opts: EnumOption[] = [];
  for (let n = 2; n <= 7; n++) opts.push({ value: n, label: `${n}/4` });
  for (let n = 5; n <= 15; n++) opts.push({ value: n + 3, label: `${n}/8` });
  return opts;
}

export const RHYTHM_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Genre",
    kind: "enum",
    default: 0,
    options: genreOptions(),
    info: "Rhythm pattern genre. The Pattern list changes with the genre.",
  },
  {
    tag: "B",
    name: "Pattern",
    kind: "enum",
    default: 0,
    options: rhythmPatternOptions(0),
    info: "Rhythm pattern. Available patterns depend on Genre. See the Parameter Guide Rhythm Pattern List.",
  },
  {
    tag: "C",
    name: "Variation",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "A" },
      { value: 1, label: "B" },
      { value: 2, label: "C" },
      { value: 3, label: "D" },
    ],
    info: "Rhythm pattern variation (A–D).",
  },
  {
    tag: "D",
    name: "Kit",
    kind: "enum",
    default: 0,
    options: RHYTHM_KITS.map((label, value) => ({ value, label })),
    info: "Drum kit used for rhythm playback.",
  },
  {
    tag: "E",
    name: "Beat",
    kind: "enum",
    default: 4,
    options: beatOptions(),
    info: "Time signature of the rhythm. You cannot change Beat after a track is recorded.",
  },
  {
    tag: "F",
    name: "Start Trig",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Loop Start" },
      { value: 1, label: "Rec End" },
      { value: 2, label: "Before Loop" },
    ],
    info: "How rhythm starts. Loop Start: with loop record/play. Rec End: when recording switches to play. Before Loop: rhythm first, then record/play on the next press.",
  },
  {
    tag: "G",
    name: "Stop Trig",
    kind: "enum",
    default: 1,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "Loop Stop" },
      { value: 2, label: "Rec End" },
    ],
    info: "How rhythm stops. Off: keeps playing (useful for MIDI sync). Loop Stop: when the loop stops. Rec End: when recording ends, as a recording guide.",
  },
  {
    tag: "H",
    name: "Intro Rec",
    kind: "bool",
    default: 0,
    info: "When ON, adds an intro while recording. The intro does not play if a track or rhythm is already playing.",
  },
  {
    tag: "I",
    name: "Intro Play",
    kind: "bool",
    default: 0,
    info: "When ON, the rhythm plays with an intro.",
  },
  {
    tag: "J",
    name: "Ending",
    kind: "bool",
    default: 0,
    info: "When ON, the rhythm plays with an ending.",
  },
  {
    tag: "K",
    name: "Fill",
    kind: "bool",
    default: 0,
    info: "When ON, the rhythm plays with a fill-in.",
  },
  {
    tag: "L",
    name: "Variation Change",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Measure" },
      { value: 1, label: "Loop End" },
    ],
    info: "When the pattern variation switches. Measure: at the end of the measure. Loop End: at the end of the loop.",
  },
];

export const ASSIGN_PARAMS: ParamDef[] = [
  { tag: "A", name: "SW", kind: "bool", default: 0 },
  { tag: "B", name: "SOURCE", kind: "int", min: 0, max: 255, default: 0 },
  {
    tag: "C",
    name: "SOURCE MODE",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "MOMENT" },
      { value: 1, label: "TOGGLE" },
    ],
  },
  { tag: "D", name: "ACT. LO", kind: "int", min: 0, max: 127, default: 0 },
  { tag: "F", name: "ACT. HI", kind: "int", min: 0, max: 127, default: 127 },
  { tag: "G", name: "TARGET", kind: "int", min: 0, max: 2047, default: 0 },
  { tag: "H", name: "TARGET MIN", kind: "int", min: 0, max: 127, default: 0 },
  { tag: "I", name: "TARGET MAX", kind: "int", min: 0, max: 127, default: 127 },
];

/** Common IFX/TFX type names seen in RC0 blocks (index → name). */
export const FX_TYPE_NAMES: string[] = [
  "THRU",
  "LPF",
  "BPF",
  "HPF",
  "PHASER",
  "FLANGER",
  "SYNTH",
  "LO_FI",
  "RING_MOD",
  "GTR_TO_BASS",
  "SLOW_GEAR",
  "TRANSPOSE",
  "PITCH_SHIFT",
  "HARMONIST",
  "VOCODER",
  "DISTORTION",
  "COMPRESSOR",
  "EQUALIZER",
  "ISOLATOR",
  "OCTAVE",
  "PAN",
  "TREMOLO",
  "AUTO_PAN",
  "CHORUS",
  "REVERB",
  "DELAY",
  "TAPE_ECHO",
  "GRANULAR_DELAY",
  "ROLL",
  "FILTER_COMP",
  "FILTER_DIST",
  "FILTER_PHASER",
  "FILTER_FLANGER",
  "BEAT_SHIFT",
  "BEAT_SCATTER",
  "BEAT_REPEAT",
  "VINYL_FLICK",
];

export const SYSTEM_SECTIONS = [
  "SETUP",
  "COLOR",
  "USB",
  "MIDI",
  "PREF",
  "INPUT",
  "OUTPUT",
  "ROUTING",
  "MIXER",
  "MASTER_FX",
] as const;

export type SystemSection = (typeof SYSTEM_SECTIONS)[number];

export function panLabel(v: number): string {
  if (v === 50) return "CENTER";
  if (v < 50) return `L${50 - v}`;
  return `R${v - 50}`;
}

export function boolLabel(v: number): string {
  return v ? "ON" : "OFF";
}

export function enumLabel(def: ParamDef, v: number): string {
  const opt = def.options?.find((o) => o.value === v);
  return opt?.label ?? String(v);
}

export function displayParam(def: ParamDef, raw: number): string {
  if (def.kind === "bool") return boolLabel(raw);
  if (def.tag === "C" && def.name === "Pan") return panLabel(raw);
  if (def.tag === "F" && def.name === "Loop Length") return loopLengthLabel(raw);
  if (def.kind === "enum") return enumLabel(def, raw);
  return String(raw);
}
