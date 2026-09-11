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
  /** How int values are shown next to the slider. */
  format?: "db" | "comp";
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

export interface AssignSource {
  value: number;
  label: string;
  info: string;
}

function midiCcLabel(cc: number): string {
  return `MIDI CC#${String(cc).padStart(2, "0")}`;
}

function buildAssignSources(): AssignSource[] {
  const out: AssignSource[] = [];
  let value = 0;
  for (let tr = 1; tr <= 6; tr++) {
    out.push({
      value: value++,
      label: `TRK${tr} REC/DB`,
      info: `When Track ${tr} switches from playback/stop to recording/overdubbing.`,
    });
  }
  for (let tr = 1; tr <= 6; tr++) {
    out.push({
      value: value++,
      label: `TRK${tr} PLY/STP`,
      info: `When Track ${tr} switches from recording/overdubbing to playback/stop.`,
    });
  }
  out.push({
    value: value++,
    label: "SYNC ST/STP",
    info: "All Start/Stop message from an external MIDI device.",
  });
  for (const mode of [1, 2, 3]) {
    for (let pedal = 1; pedal <= 9; pedal++) {
      out.push({
        value: value++,
        label: `PEDAL${pedal} MODE${mode}`,
        info: `When operating Pedal ${pedal} in pedal mode ${mode}.`,
      });
    }
  }
  for (const n of [1, 2, 3, 4] as const) {
    const jack = n <= 2 ? "the CTL 1, 2 / EXP 1 jack" : "the CTL 3, 4 / EXP 2 jack";
    out.push({
      value: value++,
      label: `CTL${n}`,
      info: `A footswitch (CTL${n}) connected to ${jack}.`,
    });
  }
  out.push(
    {
      value: value++,
      label: "EXP1",
      info: "An expression pedal (EXP1) connected to the CTL 1, 2 / EXP 1 jack.",
    },
    {
      value: value++,
      label: "EXP2",
      info: "An expression pedal (EXP2) connected to the CTL 3, 4 / EXP 2 jack.",
    },
  );
  for (let cc = 1; cc <= 31; cc++) {
    out.push({
      value: value++,
      label: midiCcLabel(cc),
      info: `Control Change ${cc} from an external MIDI device.`,
    });
  }
  for (let cc = 64; cc <= 95; cc++) {
    out.push({
      value: value++,
      label: midiCcLabel(cc),
      info: `Control Change ${cc} from an external MIDI device.`,
    });
  }
  if (value !== 109) {
    throw new Error(`ASSIGN SOURCE list ended at ${value}, expected 109`);
  }
  return out;
}

export const ASSIGN_SOURCES: AssignSource[] = buildAssignSources();

export function assignSourceOptions(): EnumOption[] {
  return ASSIGN_SOURCES.map(({ value, label }) => ({ value, label }));
}

export function assignSourceLabel(v: number): string {
  return ASSIGN_SOURCES.find((s) => s.value === v)?.label ?? String(v);
}

export function assignSourceInfo(v: number): string | undefined {
  return ASSIGN_SOURCES.find((s) => s.value === v)?.info;
}

export function assignSourceDef(tag: string, name: string, value: number): ParamDef {
  const options = assignSourceOptions();
  if (!options.some((o) => o.value === value)) options.push({ value, label: `Value ${value}` });
  return {
    tag,
    name,
    kind: "enum",
    options,
    info: assignSourceInfo(value) ?? "Specify the controller that will control the target.",
  };
}

/** Roland 1/3-octave frequencies used by INPUT / OUTPUT EQ. */
export const EQ_FREQS = [
  "20.0 Hz",
  "25.0 Hz",
  "31.5 Hz",
  "40.0 Hz",
  "50.0 Hz",
  "63.0 Hz",
  "80.0 Hz",
  "100 Hz",
  "125 Hz",
  "160 Hz",
  "200 Hz",
  "250 Hz",
  "315 Hz",
  "400 Hz",
  "500 Hz",
  "630 Hz",
  "800 Hz",
  "1.00 kHz",
  "1.25 kHz",
  "1.60 kHz",
  "2.00 kHz",
  "2.50 kHz",
  "3.15 kHz",
  "4.00 kHz",
  "5.00 kHz",
  "6.30 kHz",
  "8.00 kHz",
  "10.0 kHz",
  "12.5 kHz",
  "16.0 kHz",
] as const;

function freqOptions(fromHz: (typeof EQ_FREQS)[number], toHz: (typeof EQ_FREQS)[number]): EnumOption[] {
  const from = EQ_FREQS.indexOf(fromHz);
  const to = EQ_FREQS.indexOf(toHz);
  return EQ_FREQS.slice(from, to + 1).map((label, i) => ({ value: i, label }));
}

const EQ_Q_OPTIONS: EnumOption[] = [
  { value: 0, label: "0.5" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "4" },
  { value: 4, label: "8" },
  { value: 5, label: "16" },
];

const PHANTOM_INFO =
  "Turns phantom power on/off. Always turn phantom power off when connecting anything other than a condenser microphone that requires it.";

const GAIN_OPTIONS: EnumOption[] = [
  { value: 0, label: "INST" },
  { value: 1, label: "LINE" },
];

export const INPUT_SETUP_GROUPS: { title: string; params: ParamDef[] }[] = [
  {
    title: "Phantom",
    params: [
      { tag: "A", name: "MIC 1", kind: "bool", default: 0, info: PHANTOM_INFO },
      { tag: "B", name: "MIC 2", kind: "bool", default: 0, info: PHANTOM_INFO },
    ],
  },
  {
    title: "Gain",
    params: [
      {
        tag: "C",
        name: "INST 1 Gain",
        kind: "enum",
        default: 0,
        options: GAIN_OPTIONS,
        info: "Input gain for INST 1. INST is for guitars, basses, and keyboards. LINE is for line-level players.",
      },
      {
        tag: "D",
        name: "INST 2 Gain",
        kind: "enum",
        default: 0,
        options: GAIN_OPTIONS,
        info: "Input gain for INST 2. INST is for guitars, basses, and keyboards. LINE is for line-level players.",
      },
    ],
  },
  {
    title: "Stereo Link",
    params: [
      {
        tag: "E",
        name: "MIC",
        kind: "bool",
        default: 0,
        info: "When ON, MIC 1 and MIC 2 share the same EQ and Dynamics settings.",
      },
      {
        tag: "F",
        name: "INST 1",
        kind: "bool",
        default: 0,
        info: "When ON, INST 1 L and INST 1 R share the same EQ settings.",
      },
      {
        tag: "G",
        name: "INST 2",
        kind: "bool",
        default: 0,
        info: "When ON, INST 2 L and INST 2 R share the same EQ settings.",
      },
    ],
  },
];

export const INPUT_SETUP_PARAMS: ParamDef[] = INPUT_SETUP_GROUPS.flatMap((g) => g.params);

const LO_MID_FREQ = freqOptions("20.0 Hz", "10.0 kHz");
const HI_MID_FREQ = freqOptions("20.0 Hz", "10.0 kHz");
const LO_CUT_OPTIONS: EnumOption[] = [
  { value: 0, label: "FLAT" },
  ...freqOptions("20.0 Hz", "800 Hz").map((o) => ({ value: o.value + 1, label: o.label })),
];
const HI_CUT_OPTIONS: EnumOption[] = [
  ...freqOptions("630 Hz", "12.5 kHz"),
  { value: freqOptions("630 Hz", "12.5 kHz").length, label: "FLAT" },
];

export const INPUT_EQ_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Switch",
    kind: "bool",
    default: 0,
    info: "Turns the equalizer on/off.",
  },
  {
    tag: "B",
    name: "Lo Gain",
    kind: "int",
    min: 0,
    max: 40,
    default: 20,
    format: "db",
    info: "Gain for the low frequency range (−20–0–+20 dB).",
  },
  {
    tag: "C",
    name: "High Gain",
    kind: "int",
    min: 0,
    max: 40,
    default: 20,
    format: "db",
    info: "Gain for the high frequency range (−20–0–+20 dB).",
  },
  {
    tag: "D",
    name: "Lo Mid Freq",
    kind: "enum",
    default: 11,
    options: LO_MID_FREQ,
    info: "Center frequency for Lo Mid Gain. Default 250 Hz.",
  },
  {
    tag: "E",
    name: "Lo Mid Q",
    kind: "enum",
    default: 0,
    options: EQ_Q_OPTIONS,
    info: "Width of the Lo Mid band. Higher values narrow the area.",
  },
  {
    tag: "F",
    name: "Lo Mid Gain",
    kind: "int",
    min: 0,
    max: 40,
    default: 20,
    format: "db",
    info: "Gain for the low-middle frequency range (−20–0–+20 dB).",
  },
  {
    tag: "G",
    name: "Hi Mid Freq",
    kind: "enum",
    default: 16,
    options: HI_MID_FREQ,
    info: "Center frequency for Hi Mid Gain. Default 800 Hz.",
  },
  {
    tag: "H",
    name: "Hi Mid Q",
    kind: "enum",
    default: 0,
    options: EQ_Q_OPTIONS,
    info: "Width of the Hi Mid band. Higher values narrow the area.",
  },
  {
    tag: "I",
    name: "Hi Mid Gain",
    kind: "int",
    min: 0,
    max: 40,
    default: 20,
    format: "db",
    info: "Gain for the high-middle frequency range (−20–0–+20 dB).",
  },
  {
    tag: "J",
    name: "Level",
    kind: "int",
    min: 0,
    max: 40,
    default: 20,
    format: "db",
    info: "Overall equalizer level (−20–0–+20 dB).",
  },
  {
    tag: "K",
    name: "Lo Cut",
    kind: "enum",
    default: 0,
    options: LO_CUT_OPTIONS,
    info: "Frequency where the low-cut filter begins. FLAT disables the filter.",
  },
  {
    tag: "L",
    name: "Hi Cut",
    kind: "enum",
    default: HI_CUT_OPTIONS.length - 1,
    options: HI_CUT_OPTIONS,
    info: "Frequency where the high-cut filter begins. FLAT disables the filter.",
  },
];

export const INPUT_EQ_SECTIONS = [
  "EQ_MIC1",
  "EQ_MIC2",
  "EQ_INST1L",
  "EQ_INST1R",
  "EQ_INST2L",
  "EQ_INST2R",
] as const;

export type InputEqSection = (typeof INPUT_EQ_SECTIONS)[number];

export type InputEqChannel = {
  section: InputEqSection;
  label: string;
  linkedLabel: string;
  linkTag: "E" | "F" | "G";
  role: "primary" | "secondary";
};

export const INPUT_EQ_CHANNELS: InputEqChannel[] = [
  { section: "EQ_MIC1", label: "MIC 1", linkedLabel: "MIC", linkTag: "E", role: "primary" },
  { section: "EQ_MIC2", label: "MIC 2", linkedLabel: "MIC", linkTag: "E", role: "secondary" },
  { section: "EQ_INST1L", label: "INST 1 L", linkedLabel: "INST 1", linkTag: "F", role: "primary" },
  { section: "EQ_INST1R", label: "INST 1 R", linkedLabel: "INST 1", linkTag: "F", role: "secondary" },
  { section: "EQ_INST2L", label: "INST 2 L", linkedLabel: "INST 2", linkTag: "G", role: "primary" },
  { section: "EQ_INST2R", label: "INST 2 R", linkedLabel: "INST 2", linkTag: "G", role: "secondary" },
];

export function inputStereoLinked(tags: { [tag: string]: string | undefined }, linkTag: "E" | "F" | "G"): boolean {
  const n = parseInt(tags[linkTag] ?? "0", 10);
  return Number.isFinite(n) && n !== 0;
}

export function visibleInputEqChannels(tags: { [tag: string]: string | undefined }): InputEqChannel[] {
  return INPUT_EQ_CHANNELS.filter((ch) => ch.role === "primary" || !inputStereoLinked(tags, ch.linkTag));
}

export function inputEqChannelLabel(ch: InputEqChannel, tags: { [tag: string]: string | undefined }): string {
  return inputStereoLinked(tags, ch.linkTag) ? ch.linkedLabel : ch.label;
}

export function inputEqLinkPartner(section: InputEqSection): InputEqSection | null {
  const ch = INPUT_EQ_CHANNELS.find((c) => c.section === section);
  if (!ch) return null;
  return INPUT_EQ_CHANNELS.find((c) => c.linkTag === ch.linkTag && c.section !== section)?.section ?? null;
}

const COMP_INFO = (jack: string) =>
  `Compressor depth for ${jack} during loop recording. OFF applies no compression.`;
const NS_INFO = (jack: string) =>
  `Noise suppressor depth for ${jack} during loop recording (0–100). Default 40.`;

export const INPUT_DYNAMICS_GROUPS: {
  title: string;
  linkedTitle?: string;
  linkTag?: "E";
  role?: "primary" | "secondary";
  params: ParamDef[];
}[] = [
  {
    title: "MIC 1",
    linkedTitle: "MIC",
    linkTag: "E",
    role: "primary",
    params: [
      {
        tag: "H",
        name: "Comp",
        kind: "int",
        min: 0,
        max: 100,
        default: 0,
        format: "comp",
        info: COMP_INFO("MIC 1"),
      },
      {
        tag: "I",
        name: "NS",
        kind: "int",
        min: 0,
        max: 100,
        default: 40,
        info: NS_INFO("MIC 1"),
      },
    ],
  },
  {
    title: "MIC 2",
    linkedTitle: "MIC",
    linkTag: "E",
    role: "secondary",
    params: [
      {
        tag: "J",
        name: "Comp",
        kind: "int",
        min: 0,
        max: 100,
        default: 0,
        format: "comp",
        info: COMP_INFO("MIC 2"),
      },
      {
        tag: "K",
        name: "NS",
        kind: "int",
        min: 0,
        max: 100,
        default: 40,
        info: NS_INFO("MIC 2"),
      },
    ],
  },
  {
    title: "INST 1",
    params: [
      {
        tag: "L",
        name: "NS",
        kind: "int",
        min: 0,
        max: 100,
        default: 40,
        info: NS_INFO("INST 1"),
      },
    ],
  },
  {
    title: "INST 2",
    params: [
      {
        tag: "M",
        name: "NS",
        kind: "int",
        min: 0,
        max: 100,
        default: 40,
        info: NS_INFO("INST 2"),
      },
    ],
  },
];

export const INPUT_DYNAMICS_PARAMS: ParamDef[] = INPUT_DYNAMICS_GROUPS.flatMap((g) => g.params);

/** Tag pairs copied when MIC stereo link is turned on (MIC 1 → MIC 2). */
export const INPUT_MIC_DYNAMICS_LINK: [string, string][] = [
  ["H", "J"],
  ["I", "K"],
];

export type OutputLinkTag = "B" | "C" | "D";

export const OUTPUT_SETUP_GROUPS: { title: string; params: ParamDef[] }[] = [
  {
    title: "Output Knob",
    params: [
      {
        tag: "A",
        name: "Output Knob",
        kind: "enum",
        default: 0,
        options: [
          { value: 0, label: "ALL" },
          { value: 1, label: "MASTER" },
          { value: 2, label: "PHONES" },
          { value: 3, label: "OFF" },
        ],
        info: "What the [OUTPUT LEVEL] knob adjusts. ALL: MASTER OUT and PHONES OUT. MASTER: MAIN / SUB 1 / SUB 2. PHONES: PHONES OUT. OFF: mixer levels only.",
      },
    ],
  },
  {
    title: "Stereo Link",
    params: [
      {
        tag: "B",
        name: "MAIN",
        kind: "bool",
        default: 1,
        info: "When ON, MAIN L and MAIN R share the same routing, EQ, and Master FX Insert display.",
      },
      {
        tag: "C",
        name: "SUB 1",
        kind: "bool",
        default: 1,
        info: "When ON, SUB 1 L and SUB 1 R share the same routing and EQ settings.",
      },
      {
        tag: "D",
        name: "SUB 2",
        kind: "bool",
        default: 1,
        info: "When ON, SUB 2 L and SUB 2 R share the same routing and EQ settings.",
      },
    ],
  },
];

export const OUTPUT_SETUP_PARAMS: ParamDef[] = OUTPUT_SETUP_GROUPS.flatMap((g) => g.params);

/** Same EQ bands as INPUT EQ (Parameter Guide). */
export const OUTPUT_EQ_PARAMS: ParamDef[] = INPUT_EQ_PARAMS;

export const OUTPUT_EQ_SECTIONS = [
  "EQ_MAINOUTL",
  "EQ_MAINOUTR",
  "EQ_SUBOUT1L",
  "EQ_SUBOUT1R",
  "EQ_SUBOUT2L",
  "EQ_SUBOUT2R",
] as const;

export type OutputEqSection = (typeof OUTPUT_EQ_SECTIONS)[number];

export type OutputEqChannel = {
  section: OutputEqSection;
  label: string;
  linkedLabel: string;
  linkTag: OutputLinkTag;
  role: "primary" | "secondary";
};

export const OUTPUT_EQ_CHANNELS: OutputEqChannel[] = [
  { section: "EQ_MAINOUTL", label: "MAIN L", linkedLabel: "MAIN", linkTag: "B", role: "primary" },
  { section: "EQ_MAINOUTR", label: "MAIN R", linkedLabel: "MAIN", linkTag: "B", role: "secondary" },
  { section: "EQ_SUBOUT1L", label: "SUB 1 L", linkedLabel: "SUB 1", linkTag: "C", role: "primary" },
  { section: "EQ_SUBOUT1R", label: "SUB 1 R", linkedLabel: "SUB 1", linkTag: "C", role: "secondary" },
  { section: "EQ_SUBOUT2L", label: "SUB 2 L", linkedLabel: "SUB 2", linkTag: "D", role: "primary" },
  { section: "EQ_SUBOUT2R", label: "SUB 2 R", linkedLabel: "SUB 2", linkTag: "D", role: "secondary" },
];

export function outputStereoLinked(
  tags: { [tag: string]: string | undefined },
  linkTag: OutputLinkTag,
): boolean {
  const n = parseInt(tags[linkTag] ?? "0", 10);
  return Number.isFinite(n) && n !== 0;
}

export function visibleOutputEqChannels(tags: { [tag: string]: string | undefined }): OutputEqChannel[] {
  return OUTPUT_EQ_CHANNELS.filter((ch) => ch.role === "primary" || !outputStereoLinked(tags, ch.linkTag));
}

export function outputEqChannelLabel(
  ch: OutputEqChannel,
  tags: { [tag: string]: string | undefined },
): string {
  return outputStereoLinked(tags, ch.linkTag) ? ch.linkedLabel : ch.label;
}

export function outputEqLinkPartner(section: OutputEqSection): OutputEqSection | null {
  const ch = OUTPUT_EQ_CHANNELS.find((c) => c.section === section);
  if (!ch) return null;
  return OUTPUT_EQ_CHANNELS.find((c) => c.linkTag === ch.linkTag && c.section !== section)?.section ?? null;
}

export interface OutputRouteDest {
  id: string;
  label: string;
  linkedLabel: string;
  /** ROUTING tag: 6 track bits (bit 0 = Track 1). */
  tagTrack: string;
  /** ROUTING tag: 7 input bits (bit 0 = MIC 1). */
  tagInput: string;
  linkTag: OutputLinkTag | null;
  role: "primary" | "secondary";
  phones: boolean;
}

/** ROUTING A–G = tracks per jack; H–N = input/rhythm per jack. */
export const OUTPUT_ROUTE_DESTS: OutputRouteDest[] = [
  { id: "main-l", label: "MAIN L", linkedLabel: "MAIN", tagTrack: "A", tagInput: "H", linkTag: "B", role: "primary", phones: false },
  { id: "main-r", label: "MAIN R", linkedLabel: "MAIN", tagTrack: "B", tagInput: "I", linkTag: "B", role: "secondary", phones: false },
  { id: "sub1-l", label: "SUB 1 L", linkedLabel: "SUB 1", tagTrack: "C", tagInput: "J", linkTag: "C", role: "primary", phones: false },
  { id: "sub1-r", label: "SUB 1 R", linkedLabel: "SUB 1", tagTrack: "D", tagInput: "K", linkTag: "C", role: "secondary", phones: false },
  { id: "sub2-l", label: "SUB 2 L", linkedLabel: "SUB 2", tagTrack: "E", tagInput: "L", linkTag: "D", role: "primary", phones: false },
  { id: "sub2-r", label: "SUB 2 R", linkedLabel: "SUB 2", tagTrack: "F", tagInput: "M", linkTag: "D", role: "secondary", phones: false },
  { id: "phones", label: "PHONES", linkedLabel: "PHONES", tagTrack: "G", tagInput: "N", linkTag: null, role: "primary", phones: true },
];

export const OUTPUT_ROUTE_TRACK_BITS: TrackInputBit[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  bit: n - 1,
  name: `Track ${n}`,
  info: `Send Track ${n} to this output.`,
}));

export const OUTPUT_ROUTE_INPUT_BITS: TrackInputBit[] = [
  { bit: 0, name: "MIC 1", info: "Send MIC 1 to this output." },
  { bit: 1, name: "MIC 2", info: "Send MIC 2 to this output." },
  { bit: 2, name: "INST 1 L", info: "Send INST 1 L/MONO to this output." },
  { bit: 3, name: "INST 1 R", info: "Send INST 1 R to this output." },
  { bit: 4, name: "INST 2 L", info: "Send INST 2 L/MONO to this output." },
  { bit: 5, name: "INST 2 R", info: "Send INST 2 R to this output." },
  { bit: 6, name: "Rhythm", info: "Send the rhythm sound to this output." },
];

export type OutputRouteInputGroup = {
  name: string;
  linkedName?: string;
  /** Bits written together when this row is stereo-linked. */
  bits: number[];
  readBit: number;
  linkTag?: "E" | "F" | "G";
  role?: "primary" | "secondary";
};

export const OUTPUT_ROUTE_INPUT_GROUPS: OutputRouteInputGroup[] = [
  { name: "MIC 1", linkedName: "MIC", bits: [0, 1], readBit: 0, linkTag: "E", role: "primary" },
  { name: "MIC 2", bits: [1], readBit: 1, linkTag: "E", role: "secondary" },
  { name: "INST 1 L", linkedName: "INST 1", bits: [2, 3], readBit: 2, linkTag: "F", role: "primary" },
  { name: "INST 1 R", bits: [3], readBit: 3, linkTag: "F", role: "secondary" },
  { name: "INST 2 L", linkedName: "INST 2", bits: [4, 5], readBit: 4, linkTag: "G", role: "primary" },
  { name: "INST 2 R", bits: [5], readBit: 5, linkTag: "G", role: "secondary" },
  { name: "Rhythm", bits: [6], readBit: 6 },
];

/** ROUTING O: Phones Out SW. INDIVIDUAL reveals the PHONES destination bits. */
export const PHONES_OUT_INDIVIDUAL = 6;

const PHONES_OUT_OPTIONS: EnumOption[] = [
  { value: 0, label: "MAIN L" },
  { value: 1, label: "MAIN R" },
  { value: 2, label: "SUB 1 L" },
  { value: 3, label: "SUB 1 R" },
  { value: 4, label: "SUB 2 L" },
  { value: 5, label: "SUB 2 R" },
  { value: 6, label: "INDIVIDUAL" },
];

const INSERT_OPTIONS: EnumOption[] = [
  { value: 0, label: "MAIN L" },
  { value: 1, label: "MAIN R" },
  { value: 2, label: "SUB 1 L" },
  { value: 3, label: "SUB 1 R" },
  { value: 4, label: "SUB 2 L" },
  { value: 5, label: "SUB 2 R" },
  { value: 6, label: "OFF" },
];

export function phonesOutIndividual(routing: { [tag: string]: string | undefined }): boolean {
  const n = parseInt(routing.O ?? "0", 10);
  return n === PHONES_OUT_INDIVIDUAL;
}

export function visibleOutputRouteDests(
  output: { [tag: string]: string | undefined },
  routing: { [tag: string]: string | undefined },
): OutputRouteDest[] {
  const individual = phonesOutIndividual(routing);
  return OUTPUT_ROUTE_DESTS.filter((d) => {
    if (d.phones) return individual;
    if (d.role === "secondary" && d.linkTag && outputStereoLinked(output, d.linkTag)) return false;
    return true;
  });
}

export function outputRouteDestLabel(
  dest: OutputRouteDest,
  output: { [tag: string]: string | undefined },
): string {
  return dest.linkTag && outputStereoLinked(output, dest.linkTag) ? dest.linkedLabel : dest.label;
}

export function outputRouteLinkPartner(dest: OutputRouteDest): OutputRouteDest | null {
  if (!dest.linkTag) return null;
  return OUTPUT_ROUTE_DESTS.find((d) => d.linkTag === dest.linkTag && d.id !== dest.id) ?? null;
}

export function visibleOutputRouteInputGroups(
  input: { [tag: string]: string | undefined },
): { name: string; bits: number[]; info: string }[] {
  return OUTPUT_ROUTE_INPUT_GROUPS.filter(
    (g) => g.role !== "secondary" || !g.linkTag || !inputStereoLinked(input, g.linkTag),
  ).map((g) => {
    const linked = Boolean(g.linkTag && g.role === "primary" && inputStereoLinked(input, g.linkTag));
    const src = OUTPUT_ROUTE_INPUT_BITS.find((b) => b.bit === g.readBit);
    return {
      name: linked ? (g.linkedName ?? g.name) : g.name,
      bits: linked ? g.bits : [g.readBit],
      info: src?.info ?? "Send this source to the selected output.",
    };
  });
}

function linkedJackOptions(
  options: EnumOption[],
  output: { [tag: string]: string | undefined },
  current: number,
): EnumOption[] {
  const pairs: [number, number, OutputLinkTag, string][] = [
    [0, 1, "B", "MAIN"],
    [2, 3, "C", "SUB 1"],
    [4, 5, "D", "SUB 2"],
  ];
  const hide = new Set<number>();
  const relabel = new Map<number, string>();
  for (const [left, right, tag, name] of pairs) {
    if (!outputStereoLinked(output, tag)) continue;
    relabel.set(left, name);
    if (current !== right) hide.add(right);
  }
  return options
    .filter((o) => !hide.has(o.value))
    .map((o) => (relabel.has(o.value) ? { ...o, label: relabel.get(o.value)! } : o));
}

export const OUTPUT_PHONES_OUT: ParamDef = {
  tag: "O",
  name: "Phones Out",
  kind: "enum",
  default: 0,
  options: PHONES_OUT_OPTIONS,
  info: "Which track routing the PHONES jack follows. INDIVIDUAL uses the PHONES destination switches on Track and Input/Rhythm.",
};

export const OUTPUT_INPUT_THRU: ParamDef = {
  tag: "P",
  name: "Input Thru",
  kind: "bool",
  default: 1,
  info: "When OFF, MIC and INST input is muted and is not sent to any output jack.",
};

export const OUTPUT_RHYTHM_OUT: ParamDef = {
  tag: "Q",
  name: "Rhythm Out",
  kind: "enum",
  default: 0,
  options: [
    { value: 0, label: "OUTPUT" },
    { value: 1, label: "LOOP" },
  ],
  info: "OUTPUT sends rhythm to the jacks set ON under Rhythm. LOOP records rhythm into a loop or triggers it from MIDI notes.",
};

export const OUTPUT_PHONES_RHYTHM: ParamDef = {
  tag: "S",
  name: "Phones Rhythm",
  kind: "bool",
  default: 1,
  info: "When Phones Out is not INDIVIDUAL, send input and rhythm to PHONES.",
};

export function phonesOutDef(
  output: { [tag: string]: string | undefined },
  current: number,
): ParamDef {
  return { ...OUTPUT_PHONES_OUT, options: linkedJackOptions(PHONES_OUT_OPTIONS, output, current) };
}

export const MASTER_FX_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Comp",
    kind: "int",
    min: 0,
    max: 40,
    default: 0,
    format: "comp",
    info: "Compressor depth on the output. OFF applies no compression.",
  },
  {
    tag: "B",
    name: "Reverb",
    kind: "int",
    min: 0,
    max: 40,
    default: 0,
    info: "Reverb depth on the output (0–40).",
  },
  {
    tag: "C",
    name: "Insert",
    kind: "enum",
    default: 0,
    options: INSERT_OPTIONS,
    info: "Output jacks that receive Master FX. OFF applies no compressor or reverb.",
  },
];

export function masterFxInsertDef(
  output: { [tag: string]: string | undefined },
  current: number,
): ParamDef {
  const insert = MASTER_FX_PARAMS.find((p) => p.tag === "C")!;
  return { ...insert, options: linkedJackOptions(INSERT_OPTIONS, output, current) };
}

function mixerMute(tag: string, jack: string): ParamDef {
  return {
    tag,
    name: "Mute",
    kind: "bool",
    default: 0,
    info: `Mutes ${jack}. Pushing the mixer knob on the RC-600 also mutes this input.`,
  };
}

function mixerLevel(tag: string, info: string): ParamDef {
  return {
    tag,
    name: "Level",
    kind: "int",
    min: 0,
    max: 200,
    default: 100,
    info,
  };
}

export type MixerGroup = {
  title: string;
  linkedTitle?: string;
  linkFrom?: "input" | "output";
  linkTag?: "B" | "C" | "D" | "E" | "F" | "G";
  role?: "primary" | "secondary";
  params: ParamDef[];
};

const IN_LEVEL = (jack: string) => `Input level from ${jack} (0–200). Default 100.`;
const OUT_LEVEL = (jack: string) => `Output level for ${jack} (0–200). Default 100.`;

export const MIXER_INPUT_GROUPS: MixerGroup[] = [
  {
    title: "MIC 1",
    linkedTitle: "MIC",
    linkFrom: "input",
    linkTag: "E",
    role: "primary",
    params: [mixerMute("B", "MIC 1"), mixerLevel("A", IN_LEVEL("MIC 1"))],
  },
  {
    title: "MIC 2",
    linkedTitle: "MIC",
    linkFrom: "input",
    linkTag: "E",
    role: "secondary",
    params: [mixerMute("D", "MIC 2"), mixerLevel("C", IN_LEVEL("MIC 2"))],
  },
  {
    title: "INST 1 L",
    linkedTitle: "INST 1",
    linkFrom: "input",
    linkTag: "F",
    role: "primary",
    params: [mixerMute("F", "INST 1 L"), mixerLevel("E", IN_LEVEL("INST 1 L/MONO"))],
  },
  {
    title: "INST 1 R",
    linkedTitle: "INST 1",
    linkFrom: "input",
    linkTag: "F",
    role: "secondary",
    params: [mixerMute("H", "INST 1 R"), mixerLevel("G", IN_LEVEL("INST 1 R"))],
  },
  {
    title: "INST 2 L",
    linkedTitle: "INST 2",
    linkFrom: "input",
    linkTag: "G",
    role: "primary",
    params: [mixerMute("J", "INST 2 L"), mixerLevel("I", IN_LEVEL("INST 2 L/MONO"))],
  },
  {
    title: "INST 2 R",
    linkedTitle: "INST 2",
    linkFrom: "input",
    linkTag: "G",
    role: "secondary",
    params: [mixerMute("L", "INST 2 R"), mixerLevel("K", IN_LEVEL("INST 2 R"))],
  },
];

export const MIXER_OUTPUT_GROUPS: MixerGroup[] = [
  {
    title: "MAIN L",
    linkedTitle: "MAIN",
    linkFrom: "output",
    linkTag: "B",
    role: "primary",
    params: [mixerLevel("M", OUT_LEVEL("MAIN L"))],
  },
  {
    title: "MAIN R",
    linkedTitle: "MAIN",
    linkFrom: "output",
    linkTag: "B",
    role: "secondary",
    params: [mixerLevel("N", OUT_LEVEL("MAIN R"))],
  },
  {
    title: "SUB 1 L",
    linkedTitle: "SUB 1",
    linkFrom: "output",
    linkTag: "C",
    role: "primary",
    params: [mixerLevel("O", OUT_LEVEL("SUB 1 L"))],
  },
  {
    title: "SUB 1 R",
    linkedTitle: "SUB 1",
    linkFrom: "output",
    linkTag: "C",
    role: "secondary",
    params: [mixerLevel("P", OUT_LEVEL("SUB 1 R"))],
  },
  {
    title: "SUB 2 L",
    linkedTitle: "SUB 2",
    linkFrom: "output",
    linkTag: "D",
    role: "primary",
    params: [mixerLevel("Q", OUT_LEVEL("SUB 2 L"))],
  },
  {
    title: "SUB 2 R",
    linkedTitle: "SUB 2",
    linkFrom: "output",
    linkTag: "D",
    role: "secondary",
    params: [mixerLevel("R", OUT_LEVEL("SUB 2 R"))],
  },
  {
    title: "Loop",
    params: [mixerLevel("S", "Loop playback output level (0–200). Default 100.")],
  },
  {
    title: "Rhythm",
    params: [mixerLevel("T", "Rhythm sound output level (0–200). Default 100.")],
  },
  {
    title: "Phones",
    params: [mixerLevel("U", "PHONES output level (0–200). Default 100.")],
  },
  {
    title: "Master",
    params: [
      mixerLevel("V", "Overall output level for MAIN / SUB 1 / SUB 2 (0–200). Default 100."),
    ],
  },
];

export const MIXER_PARAMS: ParamDef[] = [...MIXER_INPUT_GROUPS, ...MIXER_OUTPUT_GROUPS].flatMap(
  (g) => g.params,
);

function mixerGroupLinked(
  group: MixerGroup,
  input: { [tag: string]: string | undefined },
  output: { [tag: string]: string | undefined },
): boolean {
  if (!group.linkTag || !group.linkFrom) return false;
  if (group.linkFrom === "input") {
    if (group.linkTag !== "E" && group.linkTag !== "F" && group.linkTag !== "G") return false;
    return inputStereoLinked(input, group.linkTag);
  }
  if (group.linkTag !== "B" && group.linkTag !== "C" && group.linkTag !== "D") return false;
  return outputStereoLinked(output, group.linkTag);
}

export function visibleMixerGroups(
  groups: MixerGroup[],
  input: { [tag: string]: string | undefined },
  output: { [tag: string]: string | undefined },
): MixerGroup[] {
  return groups.filter((g) => g.role !== "secondary" || !mixerGroupLinked(g, input, output));
}

export function mixerGroupTitle(
  group: MixerGroup,
  input: { [tag: string]: string | undefined },
  output: { [tag: string]: string | undefined },
): string {
  return mixerGroupLinked(group, input, output) ? (group.linkedTitle ?? group.title) : group.title;
}

/** Copy primary MIXER tags onto the linked secondary when stereo link is turned on. */
export function mixerCopyForInputLink(
  mixer: { [tag: string]: string | undefined },
  linkTag: "E" | "F" | "G",
): Record<string, string> {
  const primary = MIXER_INPUT_GROUPS.find((g) => g.linkTag === linkTag && g.role === "primary");
  const secondary = MIXER_INPUT_GROUPS.find((g) => g.linkTag === linkTag && g.role === "secondary");
  return mixerCopyPair(mixer, primary, secondary);
}

export function mixerCopyForOutputLink(
  mixer: { [tag: string]: string | undefined },
  linkTag: OutputLinkTag,
): Record<string, string> {
  const primary = MIXER_OUTPUT_GROUPS.find((g) => g.linkTag === linkTag && g.role === "primary");
  const secondary = MIXER_OUTPUT_GROUPS.find((g) => g.linkTag === linkTag && g.role === "secondary");
  return mixerCopyPair(mixer, primary, secondary);
}

function mixerCopyPair(
  mixer: { [tag: string]: string | undefined },
  primary?: MixerGroup,
  secondary?: MixerGroup,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!primary || !secondary) return out;
  primary.params.forEach((p, i) => {
    const to = secondary.params[i];
    if (to) out[to.tag] = mixer[p.tag] ?? String(p.default ?? 0);
  });
  return out;
}

export function mixerLinkPartner(
  tag: string,
  input: { [tag: string]: string | undefined },
  output: { [tag: string]: string | undefined },
): string | null {
  for (const groups of [MIXER_INPUT_GROUPS, MIXER_OUTPUT_GROUPS]) {
    for (const g of groups) {
      if (g.role !== "primary" || !mixerGroupLinked(g, input, output)) continue;
      const partner = groups.find((x) => x.linkTag === g.linkTag && x.role === "secondary");
      if (!partner) continue;
      const i = g.params.findIndex((p) => p.tag === tag);
      if (i >= 0) return partner.params[i]?.tag ?? null;
    }
  }
  return null;
}

export const FX_BANKS = ["A", "B", "C", "D"] as const;

export function fxSlotSection(bank: number, slot: number): string {
  return `${FX_BANKS[bank]!}${FX_BANKS[slot]!}`;
}

/** Input FX type index (slot tag C). Order matches RC0 `AA_*` blocks after THRU. */
export const INPUT_FX_TYPE_OPTIONS: EnumOption[] = [
  "THRU",
  "LPF",
  "BPF",
  "HPF",
  "Phaser",
  "Flanger",
  "Synth",
  "Lo-Fi",
  "Radio",
  "RING.MOD",
  "G2B",
  "Sustainer",
  "Auto Riff",
  "Slow Gear",
  "Transpose",
  "Pitch Bend",
  "Robot",
  "Electric",
  "HRM Manual",
  "HRM Auto",
  "Vocoder",
  "OSC Voc",
  "OSC Bot",
  "Preamp",
  "DIST",
  "Dynamics",
  "EQ",
  "Isolator",
  "Octave",
  "Auto Pan",
  "Manual Pan",
  "Stereo Enhance",
  "Tremolo",
  "Vibrato",
  "Pattern Slicer",
  "Step Slicer",
  "Delay",
  "Panning Delay",
  "Reverse Delay",
  "Mod Delay",
  "Tape Echo1",
  "Tape Echo2",
  "Granular Delay",
  "Warp",
  "Twist",
  "Roll1",
  "Roll2",
  "Freeze",
  "Chorus",
  "Reverb",
  "Gate Reverb",
  "Reverse Reverb",
].map((label, value) => ({ value, label }));

/** Bank MODE: SINGLE first in the Parameter Guide. */
export const IFX_MODE_SINGLE = 0;

const FX_LETTER_OPTIONS: EnumOption[] = FX_BANKS.map((label, value) => ({ value, label }));

export const IFX_SELECTED_BANK: ParamDef = {
  tag: "A",
  name: "Selected Bank",
  kind: "enum",
  default: 0,
  options: FX_LETTER_OPTIONS,
  info: "FX bank the RC-600 plays and edits (BANK A–D).",
};

export const IFX_BANK_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Switch",
    kind: "bool",
    default: 1,
    info: "Turns this FX bank on or off.",
  },
  {
    tag: "B",
    name: "Mode",
    kind: "enum",
    default: 1,
    options: [
      { value: 0, label: "SINGLE" },
      { value: 1, label: "MULTI" },
    ],
    info: "SINGLE: only one of FX A–D can be on. MULTI: several FX in this bank can be on together.",
  },
  {
    tag: "C",
    name: "FX Target",
    kind: "enum",
    default: 0,
    options: FX_LETTER_OPTIONS,
    info: "Which FX (A–D) the expression pedal controls for intensity in this bank.",
  },
];

const IFX_INSERT_OPTIONS: EnumOption[] = [
  { value: 0, label: "ALL" },
  { value: 1, label: "MIC 1" },
  { value: 2, label: "MIC 2" },
  { value: 3, label: "INST 1 L" },
  { value: 4, label: "INST 1 R" },
  { value: 5, label: "INST 2 L" },
  { value: 6, label: "INST 2 R" },
];

export const IFX_SLOT_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Switch",
    kind: "bool",
    default: 0,
    info: "Turns this effect on or off. In SINGLE mode only one of FX A–D can be on.",
  },
  {
    tag: "B",
    name: "Switch Mode",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "TOGGLE" },
      { value: 1, label: "MOMENT" },
    ],
    info: "TOGGLE: each press flips the effect. MOMENT: the effect is on only while the switch is held.",
  },
  {
    tag: "D",
    name: "Insert",
    kind: "enum",
    default: 0,
    options: IFX_INSERT_OPTIONS,
    info: "Inputs this effect is applied to. Stereo link on Input → Setup shows MIC / INST as one connector.",
  },
  {
    tag: "C",
    name: "Type",
    kind: "enum",
    default: 0,
    options: INPUT_FX_TYPE_OPTIONS,
    info: "Effect type for this slot. Parameters for each type come from the Input FX / Track FX List.",
  },
];

export function inputFxInsertDef(
  input: { [tag: string]: string | undefined },
  current: number,
): ParamDef {
  const insert = IFX_SLOT_PARAMS.find((p) => p.tag === "D")!;
  const pairs: [number, number, "E" | "F" | "G", string][] = [
    [1, 2, "E", "MIC"],
    [3, 4, "F", "INST 1"],
    [5, 6, "G", "INST 2"],
  ];
  const hide = new Set<number>();
  const relabel = new Map<number, string>();
  for (const [left, right, tag, name] of pairs) {
    if (!inputStereoLinked(input, tag)) continue;
    relabel.set(left, name);
    if (current !== right) hide.add(right);
  }
  return {
    ...insert,
    options: IFX_INSERT_OPTIONS.filter((o) => !hide.has(o.value)).map((o) =>
      relabel.has(o.value) ? { ...o, label: relabel.get(o.value)! } : o,
    ),
  };
}

export const ASSIGN_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Switch",
    kind: "bool",
    default: 0,
    info: "Whether this assignment is used.",
  },
  {
    tag: "B",
    name: "Source",
    kind: "enum",
    default: 0,
    options: assignSourceOptions(),
    info: "Specify the controller (source) that will control the target.",
  },
  {
    tag: "C",
    name: "Source Mode",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Moment" },
      { value: 1, label: "Toggle" },
    ],
    info: "How a momentary footswitch changes the target: held (Moment) or each press (Toggle).",
  },
  {
    tag: "D",
    name: "Act Low",
    kind: "int",
    min: 0,
    max: 127,
    default: 0,
    info: "Lowest source value that affects the target. Normally 0.",
  },
  {
    tag: "F",
    name: "Act High",
    kind: "int",
    min: 0,
    max: 127,
    default: 127,
    info: "Highest source value that affects the target. Normally 127.",
  },
  {
    tag: "G",
    name: "Target",
    kind: "int",
    min: 0,
    max: 2047,
    default: 0,
    info: "Function or parameter this assignment controls.",
  },
  {
    tag: "H",
    name: "Target Min",
    kind: "int",
    min: 0,
    max: 127,
    default: 0,
    info: "Minimum target value. The range and names depend on the selected Target.",
  },
  {
    tag: "I",
    name: "Target Max",
    kind: "int",
    min: 0,
    max: 127,
    default: 127,
    info: "Maximum target value. The range and names depend on the selected Target.",
  },
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

/** Per-track CTL FUNC names (26 each). TRACK EDIT / TRACK FX are CUR.TRK-only in RC0. */
const TRACK_CTL_FUNCS: { name: string; info: (target: string) => string }[] = [
  {
    name: "REC/PLAY1",
    info: (t) => `Push: switch record / play / overdub on ${t}.`,
  },
  {
    name: "REC/PLAY2",
    info: (t) =>
      `Push: switch record / play / overdub on ${t}. Hold during play/overdub: Undo, hold again: Redo.`,
  },
  {
    name: "REC/PLAY3",
    info: (t) =>
      `Push: switch record / play / overdub on ${t}. Hold: Undo/Redo. Double-click: Stop.`,
  },
  {
    name: "REC/PLAY4",
    info: (t) =>
      `Push: switch record / play / overdub on ${t}. Hold during rec/play: Undo/Redo. Hold while stopped: Clear. Double-click: Stop.`,
  },
  {
    name: "MOMENT PLAY",
    info: (t) => `${t} plays only while you hold the switch.`,
  },
  {
    name: "PLAY/STOP1",
    info: (t) => `Push: play / stop ${t}.`,
  },
  {
    name: "PLAY/STOP2",
    info: (t) => `Push: play / stop ${t}. Hold during play/overdub: Undo, hold again: Redo.`,
  },
  {
    name: "PLAY/STOP3",
    info: (t) =>
      `Push: play / stop ${t}. Hold during rec/play: Undo/Redo. Hold while stopped: Clear.`,
  },
  { name: "STOP1", info: (t) => `Push: stop record / play on ${t}.` },
  {
    name: "STOP2",
    info: (t) => `Push: stop ${t}. Double-click: tap tempo (long-press reverts tempo).`,
  },
  {
    name: "STOP3",
    info: (t) => `Push: stop ${t}. Hold: Clear. Double-click: tap tempo.`,
  },
  { name: "STOP4", info: (t) => `Push: stop ${t}. Hold: Clear.` },
  { name: "STOP5", info: (t) => `Push: stop ${t}. Double-click: Clear.` },
  { name: "CLEAR", info: (t) => `Push: clear ${t}.` },
  { name: "REVERSE", info: (t) => `Push: reverse play on/off for ${t}.` },
  {
    name: "UNDO/REDO",
    info: (t) => `Push: undo / redo recording or the last overdub on ${t}.`,
  },
  {
    name: "MARK BACK1",
    info: (t) =>
      `Push: restore the marked overdub on ${t}. If no mark is set, restore the post-record state.`,
  },
  {
    name: "MARK BACK2",
    info: (t) =>
      `Push: restore the marked overdub on ${t}. Hold: restore how ${t} was right after recording.`,
  },
  {
    name: "REC BACK",
    info: (t) => `Push: restore ${t} to how it was right after recording.`,
  },
  { name: "MARK SET1", info: (t) => `Push: mark the current overdub state on ${t}.` },
  {
    name: "MARK SET2",
    info: (t) => `Push: mark the current overdub on ${t}. Hold: clear the mark.`,
  },
  { name: "MARK CLEAR", info: (t) => `Push: delete the mark on ${t}.` },
  { name: "HALF SPEED", info: (t) => `Push: set ${t} playback speed to 1/2.` },
  {
    name: "HALF SPEED (MOMENT)",
    info: (t) => `${t} plays at half speed while you hold the switch.`,
  },
  { name: "DOUBLE SPEED", info: (t) => `Push: set ${t} playback speed to 2x.` },
  {
    name: "DOUBLE SPEED (MOMENT)",
    info: (t) => `${t} plays at double speed while you hold the switch.`,
  },
];

export interface CtlFunction {
  value: number;
  label: string;
  info: string;
}

function buildCtlFunctions(): CtlFunction[] {
  const out: CtlFunction[] = [
    { value: 0, label: "OFF", info: "No function is assigned." },
  ];
  let value = 1;
  for (let tr = 1; tr <= 6; tr++) {
    const target = `Track ${tr}`;
    for (const fn of TRACK_CTL_FUNCS) {
      out.push({ value, label: `TRK${tr} ${fn.name}`, info: fn.info(target) });
      value += 1;
    }
  }
  const cur = "the current track";
  for (const fn of TRACK_CTL_FUNCS) {
    out.push({ value, label: `CUR.TRK ${fn.name}`, info: fn.info(cur) });
    value += 1;
  }
  out.push(
    {
      value: value++,
      label: "CUR.TRK TRACK EDIT",
      info: "Push: show the TRACK screen for the current track.",
    },
    {
      value: value++,
      label: "CUR.TRK TRACK FX",
      info: "Push: turn Track FX on/off for the current track.",
    },
    {
      value: value++,
      label: "CUR.TRK INC",
      info: "Push: switch the current track 1 → 2 → … → 6.",
    },
  );
  const rest: CtlFunction[] = [
    {
      value: 186,
      label: "ALL START/STOP1",
      info: "Push: start or stop all tracks. Fade in/out follows each track’s Start/Stop Mode.",
    },
    {
      value: 187,
      label: "ALL START/STOP2",
      info: "Push: start or stop all tracks (fade follows Start/Stop Mode). Hold: All Clear.",
    },
    {
      value: 188,
      label: "ALL START/STOP3",
      info: "Push: start or stop all tracks (fade follows Start/Stop Mode). Double-click: All Clear.",
    },
    { value: 189, label: "ALL CLEAR1", info: "Push: clear all tracks." },
    {
      value: 190,
      label: "TAP TEMPO",
      info: "Push: tap tempo. Long-press or hold: revert to the previous tempo.",
    },
    { value: 191, label: "TEMPO UP", info: "Push: double the tempo." },
    { value: 192, label: "TEMPO DOWN", info: "Push: set the tempo to 1/2." },
    {
      value: 193,
      label: "PEDAL MODE",
      info: "Push: switch between pedal mode 1 and 2. Hold: mode 3.",
    },
    {
      value: 194,
      label: "PEDAL MODE INC",
      info: "Push: switch pedal mode 1 → 2 → 3.",
    },
    { value: 195, label: "INPUT FX", info: "Push: turn Input FX on/off." },
    { value: 196, label: "INPUT FX A", info: "Push: turn Input FX A on/off for the current bank." },
    { value: 197, label: "INPUT FX B", info: "Push: turn Input FX B on/off for the current bank." },
    { value: 198, label: "INPUT FX C", info: "Push: turn Input FX C on/off for the current bank." },
    { value: 199, label: "INPUT FX D", info: "Push: turn Input FX D on/off for the current bank." },
    {
      value: 200,
      label: "INPUT FX CUR",
      info: "Push: turn the currently selected Input FX on/off.",
    },
    { value: 201, label: "TRACK FX", info: "Push: turn Track FX on/off." },
    { value: 202, label: "TRACK FX A", info: "Push: turn Track FX A on/off for the current bank." },
    { value: 203, label: "TRACK FX B", info: "Push: turn Track FX B on/off for the current bank." },
    { value: 204, label: "TRACK FX C", info: "Push: turn Track FX C on/off for the current bank." },
    { value: 205, label: "TRACK FX D", info: "Push: turn Track FX D on/off for the current bank." },
    {
      value: 206,
      label: "TRACK FX CUR",
      info: "Push: turn the currently selected Track FX on/off.",
    },
    {
      value: 207,
      label: "RHYTHM START/STOP",
      info: "Push: start or stop the rhythm.",
    },
    { value: 208, label: "RHYTHM START", info: "Push: start the rhythm." },
    { value: 209, label: "RHYTHM STOP", info: "Push: stop the rhythm." },
    {
      value: 210,
      label: "MEMORY INC1",
      info: "Push: switch memory 01 → 02 → … → 99.",
    },
    {
      value: 211,
      label: "MEMORY DEC1",
      info: "Push: switch memory 99 → 98 → … → 01.",
    },
    {
      value: 212,
      label: "MEMORY WRITE",
      info: "Push: write the settings in the current memory.",
    },
    { value: 213, label: "MIC IN MUTE", info: "Push: mute MIC 1 and MIC 2." },
    { value: 214, label: "MIC1 IN MUTE", info: "Push: mute MIC 1." },
    { value: 215, label: "MIC2 IN MUTE", info: "Push: mute MIC 2." },
    {
      value: 216,
      label: "LED",
      info: "Push: switch the indicator color (when lit) to the color that was set.",
    },
  ];
  if (value !== 186) {
    throw new Error(`CTL FUNC current-track block ended at ${value}, expected 186`);
  }
  return out.concat(rest);
}

export const CTL_FUNCTIONS: CtlFunction[] = buildCtlFunctions();

export function ctlFunctionOptions(): EnumOption[] {
  return CTL_FUNCTIONS.map(({ value, label }) => ({ value, label }));
}

export function ctlFunctionLabel(v: number): string {
  return CTL_FUNCTIONS.find((f) => f.value === v)?.label ?? String(v);
}

export function ctlFunctionInfo(v: number): string | undefined {
  return CTL_FUNCTIONS.find((f) => f.value === v)?.info;
}

export function ctlFunctionDef(tag: string, name: string, value: number, role?: string): ParamDef {
  const options = ctlFunctionOptions();
  if (!options.some((o) => o.value === value)) options.push({ value, label: `Value ${value}` });
  const selected = ctlFunctionInfo(value);
  const info = [role, selected].filter(Boolean).join(" ");
  return { tag, name, kind: "enum", options, info: info || undefined };
}

export const EXP_FUNCTIONS: CtlFunction[] = [
  { value: 0, label: "OFF", info: "No function is assigned." },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    value: n,
    label: `TRK${n} LEVEL1`,
    info: `Control Track ${n} Play Level from 0–200.`,
  })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({
    value: n + 6,
    label: `TRK${n} LEVEL2`,
    info: `Control Track ${n} level from 0 up to that track’s Play Level.`,
  })),
  {
    value: 13,
    label: "CUR.TRK LEVEL1",
    info: "Control the current track Play Level from 0–200.",
  },
  {
    value: 14,
    label: "CUR.TRK LEVEL2",
    info: "Control the current track level from 0 up to its Play Level.",
  },
  { value: 15, label: "TEMPO UP", info: "Press the pedal to make the tempo faster." },
  { value: 16, label: "TEMPO DOWN", info: "Press the pedal to make the tempo slower." },
  ...["A", "B", "C", "D"].map((slot, i) => ({
    value: 17 + i,
    label: `IN FX ${slot} CTL`,
    info: `Control the intensity of Input FX ${slot} in the current bank.`,
  })),
  {
    value: 21,
    label: "IN FX CUR CTL",
    info: "Control the intensity of the currently selected Input FX.",
  },
  ...["A", "B", "C", "D"].map((slot, i) => ({
    value: 22 + i,
    label: `TR FX ${slot} CTL`,
    info: `Control the intensity of Track FX ${slot} in the current bank.`,
  })),
  {
    value: 26,
    label: "TR FX CUR CTL",
    info: "Control the intensity of the currently selected Track FX.",
  },
  {
    value: 27,
    label: "RHYTHM LEVEL1",
    info: "Control Rhythm Out from 0–200.",
  },
  {
    value: 28,
    label: "RHYTHM LEVEL2",
    info: "Control rhythm level from 0 up to Rhythm Out.",
  },
];

export function expFunctionOptions(): EnumOption[] {
  return EXP_FUNCTIONS.map(({ value, label }) => ({ value, label }));
}

export function expFunctionLabel(v: number): string {
  return EXP_FUNCTIONS.find((f) => f.value === v)?.label ?? String(v);
}

export function expFunctionDef(tag: string, name: string, value: number): ParamDef {
  const options = expFunctionOptions();
  if (!options.some((o) => o.value === value)) options.push({ value, label: `Value ${value}` });
  return {
    tag,
    name,
    kind: "enum",
    options,
    info: EXP_FUNCTIONS.find((f) => f.value === value)?.info,
  };
}

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

const MEM_SYS_OPTIONS: EnumOption[] = [
  { value: 0, label: "MEMORY" },
  { value: 1, label: "SYSTEM" },
];

const PREF_INFO =
  "MEMORY uses the settings stored in the current memory. SYSTEM uses the global SYSTEM settings. Write the memory when switching to MEMORY.";

function prefParam(tag: string, name: string): ParamDef {
  return {
    tag,
    name,
    kind: "enum",
    default: 1,
    options: MEM_SYS_OPTIONS,
    info: PREF_INFO,
  };
}

/** PREF section — Input (shown under System → Input → Setup). */
export const PREF_INPUT_GROUP: { title: string; params: ParamDef[] } = {
  title: "Preference",
  params: [prefParam("A", "MIC"), prefParam("B", "INST 1"), prefParam("C", "INST 2")],
};

/** PREF section — Output (shown under System → Output → Setup). */
export const PREF_OUTPUT_GROUP: { title: string; params: ParamDef[] } = {
  title: "Preference",
  params: [
    prefParam("D", "MAIN"),
    prefParam("E", "SUB 1"),
    prefParam("F", "SUB 2"),
    prefParam("G", "PHONES"),
    prefParam("H", "Rhythm"),
    prefParam("I", "Master FX"),
  ],
};

/** PREF section — Ctl Func. */
export const PREF_CTL_GROUP: { title: string; params: ParamDef[] } = {
  title: "Preference",
  params: [
    prefParam("J", "Mode 1"),
    prefParam("K", "Mode 2"),
    prefParam("L", "Mode 3"),
    prefParam("M", "CTL 1"),
    prefParam("N", "CTL 2"),
    prefParam("O", "CTL 3"),
    prefParam("P", "CTL 4"),
    prefParam("Q", "EXP 1"),
    prefParam("R", "EXP 2"),
  ],
};

export const PREF_ALL_CLEAR: ParamDef = {
  tag: "S",
  name: "All Clear",
  kind: "bool",
  default: 1,
  info: "When ON, long-pressing ALL START/STOP clears all tracks.",
};

export const USB_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Storage",
    kind: "enum",
    default: 1,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "Connect" },
    ],
    info: "USB Storage must be Connect for the editor to read/write the ROLAND folder. Shown locked here because this session is already using Storage.",
  },
  {
    tag: "B",
    name: "Audio Mode",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Generic" },
      { value: 1, label: "Vendor" },
    ],
    info: "USB audio driver. Generic uses the OS driver. Vendor needs the BOSS driver from boss.info/support.",
  },
  {
    tag: "C",
    name: "Routing",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Line Out" },
      { value: 1, label: "Sub Mix" },
      { value: 2, label: "Loop In" },
    ],
    info: "Where USB audio from the computer is sent. Loop In can be recorded into tracks.",
  },
  {
    tag: "D",
    name: "Input Level",
    kind: "int",
    min: 0,
    max: 200,
    default: 100,
    info: "Level of audio coming from the computer into the RC-600 (0–200).",
  },
  {
    tag: "E",
    name: "Output Level",
    kind: "int",
    min: 0,
    max: 200,
    default: 100,
    info: "Level of audio leaving the RC-600 USB port to the computer (0–200).",
  },
];

/** Storage is fixed to Connect while editing over USB Storage. */
export const USB_STORAGE_CONNECT = 1;

const MIDI_CH_OPTIONS: EnumOption[] = Array.from({ length: 16 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

export const MIDI_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Rx CTL CH",
    kind: "enum",
    default: 1,
    options: MIDI_CH_OPTIONS,
    info: "MIDI channel for control changes that switch memories or control the RC-600.",
  },
  {
    tag: "C",
    name: "Rx Rhythm CH",
    kind: "enum",
    default: 10,
    options: MIDI_CH_OPTIONS,
    info: "MIDI channel for note messages that play the rhythm.",
  },
  {
    tag: "D",
    name: "Rx Voice CH",
    kind: "enum",
    default: 1,
    options: MIDI_CH_OPTIONS,
    info: "MIDI channel for note messages used by Harmonist and Vocoder.",
  },
  {
    tag: "E",
    name: "Tx CH",
    kind: "enum",
    default: 16,
    options: [...MIDI_CH_OPTIONS, { value: 17, label: "Rx CTL" }],
    info: "MIDI transmit channel. Rx CTL follows the Rx CTL CH setting.",
  },
  {
    tag: "F",
    name: "Sync Clock",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Auto" },
      { value: 1, label: "Internal" },
      { value: 2, label: "MIDI" },
      { value: 3, label: "USB (Auto)" },
    ],
    info: "Tempo clock source. Auto prefers MIDI, then USB, then internal.",
  },
  {
    tag: "G",
    name: "Clock Out",
    kind: "bool",
    default: 1,
    info: "Transmit MIDI clock when ON.",
  },
  {
    tag: "H",
    name: "Start",
    kind: "enum",
    default: 1,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "All" },
      { value: 2, label: "Rhythm" },
    ],
    info: "What starts when a MIDI Start message is received.",
  },
  {
    tag: "I",
    name: "PC Out",
    kind: "bool",
    default: 0,
    info: "Transmit program change messages when ON.",
  },
  {
    tag: "J",
    name: "Thru MIDI In",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "MIDI Out" },
      { value: 2, label: "USB Out" },
      { value: 3, label: "USB & MIDI" },
    ],
    info: "Where messages received at MIDI IN are forwarded.",
  },
  {
    tag: "K",
    name: "Thru USB In",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "Off" },
      { value: 1, label: "MIDI Out" },
      { value: 2, label: "USB Out" },
      { value: 3, label: "USB & MIDI" },
    ],
    info: "Where messages received at the USB port are forwarded.",
  },
];

const DISPLAY_MODE_OPTIONS: EnumOption[] = [
  { value: 0, label: "Memory Number" },
  { value: 1, label: "Track Status" },
  { value: 2, label: "Loop Tracks" },
  { value: 3, label: "Loop Status" },
  { value: 4, label: "Loop Level" },
  { value: 5, label: "Input FX" },
  { value: 6, label: "Track FX" },
];

const INDICAT_OPTIONS: EnumOption[] = [
  { value: 0, label: "Loop" },
  { value: 1, label: "Rhythm" },
  { value: 2, label: "Beat" },
  { value: 3, label: "Tempo" },
];

/** LOOP STATUS COLOR for [REC/PLAY] 1–6 (Parameter Guide COLOR). */
const LOOP_STATUS_COLOR_OPTIONS: EnumOption[] = [
  { value: 0, label: "Off" },
  { value: 1, label: "Red" },
  { value: 2, label: "Green" },
  { value: 3, label: "Amber" },
  { value: 4, label: "Blue" },
  { value: 5, label: "Purple" },
  { value: 6, label: "Cyan" },
  { value: 7, label: "White" },
];

export interface KnobFunction {
  value: number;
  label: string;
  info: string;
}

/**
 * KNOB FUNC 1–4 values (Parameter Guide SETUP).
 * Indices verified against fixtures: 1=Memory, 116=Rhythm Level, 118=Rhythm Kit.
 */
function buildKnobFunctions(): KnobFunction[] {
  const out: KnobFunction[] = [];
  const push = (label: string, info: string) => {
    out.push({ value: out.length, label, info });
  };

  push("OFF", "No function is assigned.");
  push("MEMORY", "Switch memories.");

  for (let tr = 1; tr <= 6; tr++) {
    const t = `Track ${tr}`;
    push(`TRK${tr} REVERSE`, `Control Reverse for ${t}.`);
    push(`TRK${tr} 1SHOT`, `Control 1SHOT for ${t}.`);
    push(`TRK${tr} PAN`, `Control Pan for ${t}.`);
    push(`TRK${tr} LEVEL`, `Control Play Level for ${t}.`);
    push(`TRK${tr} DUB`, `Control Dub Mode for ${t}.`);
    push(`TRK${tr} FX`, `Control Input FX / Track FX for ${t}.`);
    push(`TRK${tr} BNC IN`, `Turn bounce recording on/off for ${t}.`);
  }

  push("DUB MODE", "Control Dub Mode.");
  push("AUTO REC", "Turn auto recording on/off.");
  push("BOUNCE", "Turn bounce recording on/off.");
  push("CURRENT TRACK", "Switch the current track.");
  push("FD TIME IN", "Control Fade Time In.");
  push("FD TIME OUT", "Control Fade Time Out.");

  for (const slot of ["A", "B", "C", "D"] as const) {
    push(`IN FX ${slot} SW`, `Turn Input FX ${slot} on/off for the current FX bank.`);
  }
  for (const slot of ["A", "B", "C", "D"] as const) {
    push(`IN FX ${slot} TYPE`, `Switch Input FX ${slot} type for the current FX bank.`);
  }
  for (const slot of ["A", "B", "C", "D"] as const) {
    for (let prm = 1; prm <= 4; prm++) {
      push(
        `IN FX ${slot} PRM${prm}`,
        `Control Input FX ${slot} parameter ${prm} for the current FX bank.`,
      );
    }
  }
  for (const slot of ["A", "B", "C", "D"] as const) {
    push(
      `IN FX ${slot} SW MODE`,
      `Toggle / Moment for Input FX ${slot} in the current FX bank.`,
    );
  }
  push("IN FX BANK", "Switch the Input FX bank.");
  push("IN FX MODE", "Control Input FX Mode.");
  push("IN FX SW", "Turn Input FX on/off.");
  push("IN FX TARGET", "Switch which Input FX is controlled in the current bank.");
  push("IN FX SW MODE", "Toggle / Moment for Input FX A–D together in the current bank.");

  for (const slot of ["A", "B", "C", "D"] as const) {
    push(`TR FX ${slot} SW`, `Turn Track FX ${slot} on/off for the current FX bank.`);
  }
  for (const slot of ["A", "B", "C", "D"] as const) {
    push(`TR FX ${slot} TYPE`, `Switch Track FX ${slot} type for the current FX bank.`);
  }
  for (const slot of ["A", "B", "C", "D"] as const) {
    for (let prm = 1; prm <= 4; prm++) {
      push(
        `TR FX ${slot} PRM${prm}`,
        `Control Track FX ${slot} parameter ${prm} for the current FX bank.`,
      );
    }
  }
  for (const slot of ["A", "B", "C", "D"] as const) {
    push(
      `TR FX ${slot} SW MODE`,
      `Toggle / Moment for Track FX ${slot} in the current FX bank.`,
    );
  }
  push("TR FX BANK", "Switch the Track FX bank.");
  push("TR FX MODE", "Control Track FX Mode.");
  push("TR FX SW", "Turn Track FX on/off.");
  push("TR FX TARGET", "Switch which Track FX is controlled in the current bank.");
  push("TR FX SW MODE", "Toggle / Moment for Track FX A–D together in the current bank.");

  push("RHYTHM LEVEL", "Adjust rhythm volume.");
  push("RHYTHM VARI", "Switch the rhythm pattern variation.");
  push("RHYTHM KIT", "Switch the drum kit.");
  push("RHYTHM R.INTRO", "Control Rhythm Intro Rec.");
  push("RHYTHM P.INTRO", "Control Rhythm Intro Play.");
  push("RHYTHM ENDING", "Control Rhythm Ending.");

  push("MIC1 LEVEL", "MIC 1 input level.");
  push("MIC2 LEVEL", "MIC 2 input level.");
  push("MIC1 MUTE", "Mute MIC 1.");
  push("MIC2 MUTE", "Mute MIC 2.");
  push("INST1 LEVEL", "INST 1 L/MONO input level.");
  push("INST2 LEVEL", "INST 2 L/MONO input level.");
  push("INST1 MUTE", "Mute INST 1 L/MONO.");
  push("INST2 MUTE", "Mute INST 2 L/MONO.");
  push("INST1R LEVEL", "INST 1 R input level.");
  push("INST2R LEVEL", "INST 2 R input level.");
  push("INST1R MUTE", "Mute INST 1 R.");
  push("INST2R MUTE", "Mute INST 2 R.");

  push("LOOP LEVEL", "Loop playback output level.");
  push("RHYTHM OUT LEVEL", "Rhythm sound output level.");
  push("MAIN LEVEL", "MAIN L output level.");
  push("MAIN R LEVEL", "MAIN R output level.");
  push("SUB1 LEVEL", "SUB 1 L output level.");
  push("SUB2 LEVEL", "SUB 2 L output level.");
  push("SUB1R LEVEL", "SUB 1 R output level.");
  push("SUB2R LEVEL", "SUB 2 R output level.");
  push("PHONES LEVEL", "PHONES output level.");
  push("MASTER LEVEL", "Overall MAIN / SUB 1 / SUB 2 output level.");
  push("INST1 GAIN", "Control INST 1 Gain.");
  push("INST2 GAIN", "Control INST 2 Gain.");

  const eqParams = [
    "SW",
    "LO G",
    "HI G",
    "LM F",
    "LM Q",
    "LM G",
    "HM F",
    "HM Q",
    "HM G",
    "LVL",
    "LO C",
    "HI C",
  ] as const;
  for (const ch of ["MIC1", "MIC2", "INST1L", "INST1R", "INST2L", "INST2R"] as const) {
    for (const p of eqParams) {
      push(`${ch} EQ ${p}`, `Input EQ ${ch}: ${p}.`);
    }
  }

  push("MIC1 COMP", "MIC 1 compressor.");
  push("MIC2 COMP", "MIC 2 compressor.");
  push("MIC1 NS", "MIC 1 noise suppressor.");
  push("MIC2 NS", "MIC 2 noise suppressor.");
  push("INST1 NS", "INST 1 noise suppressor.");
  push("INST2 NS", "INST 2 noise suppressor.");

  push("RHYTHM OUT", "Control Rhythm Out routing.");
  push("INPUT THRU", "Control Input Thru routing.");
  push("PHONES OUT", "Control Phones Out.");

  for (const ch of ["MAINL", "MAINR", "SUB1L", "SUB1R", "SUB2L", "SUB2R"] as const) {
    for (const p of eqParams) {
      push(`${ch} EQ ${p}`, `Output EQ ${ch}: ${p}.`);
    }
  }

  push("MFX COMP", "Control Master FX Compressor.");
  push("MFX REVERB", "Control Master FX Reverb.");
  push("PEDAL MODE", "Switch pedal mode.");
  push("DISPLAY MODE", "Switch the play screen.");
  push("LOOP INDICAT", "Control Loop Indicator (SETUP).");
  push("ORB INDICAT", "Control Orb Indicator (SETUP).");

  return out;
}

export const KNOB_FUNCTIONS: KnobFunction[] = buildKnobFunctions();

export function knobFunctionOptions(): EnumOption[] {
  return KNOB_FUNCTIONS.map(({ value, label }) => ({ value, label }));
}

export function knobFunctionLabel(v: number): string {
  return KNOB_FUNCTIONS.find((f) => f.value === v)?.label ?? String(v);
}

export function knobFunctionInfo(v: number): string | undefined {
  return KNOB_FUNCTIONS.find((f) => f.value === v)?.info;
}

export function knobFunctionDef(tag: string, name: string, value: number): ParamDef {
  const options = knobFunctionOptions();
  if (!options.some((o) => o.value === value)) options.push({ value, label: `Value ${value}` });
  return {
    tag,
    name,
    kind: "enum",
    options,
    default: value,
    info: knobFunctionInfo(value),
  };
}

/**
 * SYSTEM SETUP tags (RC0 order ≠ menu order).
 * A/C = Memory Ext (fixture 11…98 / 25…98); B = Display; D/E = indicators;
 * H = Auto Off; I = Contrast; K–N = Knob Func 1–4 (116/118/116/1 in fixtures).
 * F/G/J/O–V stay unmapped until verified (Owner’s Manual still lists FX Knob Mode).
 */
export const SETUP_GROUPS: { title: string; params: ParamDef[] }[] = [
  {
    title: "Display",
    params: [
      {
        tag: "I",
        name: "Contrast",
        kind: "int",
        min: 1,
        max: 10,
        default: 6,
        info: "Display contrast (1–10).",
      },
      {
        tag: "B",
        name: "Display Mode",
        kind: "enum",
        default: 0,
        options: DISPLAY_MODE_OPTIONS,
        info: "Play screen shown right after power-on.",
      },
    ],
  },
  {
    title: "Indicators",
    params: [
      {
        tag: "D",
        name: "Loop Indicator",
        kind: "enum",
        default: 0,
        options: INDICAT_OPTIONS,
        info: "What the outer ring of the loop indicator shows.",
      },
      {
        tag: "E",
        name: "Orb Indicator",
        kind: "enum",
        default: 0,
        options: INDICAT_OPTIONS,
        info: "What the center ring of the loop indicator shows.",
      },
    ],
  },
  {
    title: "Power",
    params: [
      {
        tag: "H",
        name: "Auto Off",
        kind: "bool",
        default: 1,
        info: "When ON, power turns off after 10 hours with no play or operation.",
      },
    ],
  },
  {
    title: "Memory Ext",
    params: [
      {
        tag: "A",
        name: "Min",
        kind: "int",
        min: 1,
        max: 99,
        default: 1,
        info: "Lowest memory number available when switching memories.",
      },
      {
        tag: "C",
        name: "Max",
        kind: "int",
        min: 1,
        max: 99,
        default: 99,
        info: "Highest memory number available when switching memories.",
      },
    ],
  },
  {
    title: "Knob Func",
    params: [
      knobFunctionDef("K", "Knob 1", 1),
      knobFunctionDef("L", "Knob 2", 0),
      knobFunctionDef("M", "Knob 3", 0),
      knobFunctionDef("N", "Knob 4", 300),
    ],
  },
];

export const SETUP_PARAMS: ParamDef[] = SETUP_GROUPS.flatMap((g) => g.params);

/** SETUP letter tags that already have labeled controls. */
export const SETUP_MAPPED_TAGS = new Set(SETUP_PARAMS.map((p) => p.tag));

export const COLOR_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "Rec",
    kind: "enum",
    default: 1,
    options: LOOP_STATUS_COLOR_OPTIONS,
    info: "REC/PLAY indicator color while recording. Default: Red.",
  },
  {
    tag: "B",
    name: "Play",
    kind: "enum",
    default: 2,
    options: LOOP_STATUS_COLOR_OPTIONS,
    info: "REC/PLAY indicator color while playing. Default: Green.",
  },
  {
    tag: "C",
    name: "Dub",
    kind: "enum",
    default: 3,
    options: LOOP_STATUS_COLOR_OPTIONS,
    info: "REC/PLAY indicator color while overdubbing. Default: Amber.",
  },
  {
    tag: "D",
    name: "Stop",
    kind: "enum",
    default: 7,
    options: LOOP_STATUS_COLOR_OPTIONS,
    info: "REC/PLAY indicator color while stopped. Default: White.",
  },
  {
    tag: "E",
    name: "Blank",
    kind: "enum",
    default: 4,
    options: LOOP_STATUS_COLOR_OPTIONS,
    info: "REC/PLAY indicator color with no phrase. Default: Blue.",
  },
];

export function panLabel(v: number): string {
  if (v === 50) return "CENTER";
  if (v < 50) return `L${50 - v}`;
  return `R${v - 50}`;
}

export function dbLabel(v: number): string {
  const db = v - 20;
  if (db > 0) return `+${db} dB`;
  return `${db} dB`;
}

export function compLabel(v: number): string {
  return v <= 0 ? "OFF" : String(v);
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
  if (def.format === "db") return dbLabel(raw);
  if (def.format === "comp") return compLabel(raw);
  if (def.tag === "C" && def.name === "Pan") return panLabel(raw);
  if (def.tag === "F" && def.name === "Loop Length") return loopLengthLabel(raw);
  if (def.kind === "enum") return enumLabel(def, raw);
  return String(raw);
}
