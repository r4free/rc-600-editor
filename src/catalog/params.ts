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
}

export const TRACK_PARAMS: ParamDef[] = [
  { tag: "A", name: "REVERSE", kind: "bool", default: 0 },
  { tag: "B", name: "1SHOT", kind: "bool", default: 0 },
  {
    tag: "C",
    name: "PAN",
    kind: "int",
    min: 0,
    max: 100,
    default: 50,
  },
  { tag: "D", name: "PLAY LEVEL", kind: "int", min: 0, max: 200, default: 100 },
  {
    tag: "E",
    name: "START MODE",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "IMMEDIATE" },
      { value: 1, label: "FADE" },
    ],
  },
  {
    tag: "F",
    name: "STOP MODE",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "IMMEDIATE" },
      { value: 1, label: "FADE" },
      { value: 2, label: "LOOP" },
    ],
  },
  {
    tag: "G",
    name: "DUB MODE",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "OVERDUB" },
      { value: 1, label: "REPLACE1" },
      { value: 2, label: "REPLACE2" },
    ],
  },
  { tag: "H", name: "FX", kind: "bool", default: 1 },
  {
    tag: "I",
    name: "PLAY MODE",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "MULTI" },
      { value: 1, label: "SINGLE" },
    ],
  },
  { tag: "L", name: "LOOP SYNC SW", kind: "bool", default: 1 },
  { tag: "M", name: "TEMPO SYNC SW", kind: "bool", default: 1 },
  { tag: "N", name: "BOUNCE IN", kind: "bool", default: 0 },
];

export const REC_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "REC ACTION",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "REC->DUB" },
      { value: 1, label: "REC->PLAY" },
    ],
  },
  {
    tag: "B",
    name: "QUANTIZE",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "OFF" },
      { value: 1, label: "MEASURE" },
    ],
  },
  { tag: "C", name: "AUTO REC SW", kind: "bool", default: 0 },
  { tag: "D", name: "AUTO REC SENS", kind: "int", min: 0, max: 100, default: 50 },
  { tag: "E", name: "BOUNCE SW", kind: "bool", default: 0 },
];

export const PLAY_PARAMS: ParamDef[] = [
  {
    tag: "A",
    name: "SINGL CHNGE",
    kind: "enum",
    default: 0,
    options: [
      { value: 0, label: "IMMEDIATE" },
      { value: 1, label: "LOOP END" },
    ],
  },
  { tag: "B", name: "FADE TIME IN", kind: "int", min: 0, max: 64, default: 5 },
  { tag: "C", name: "FADE TIME OUT", kind: "int", min: 0, max: 64, default: 5 },
  { tag: "H", name: "ALL START", kind: "bool", default: 1 },
];

export const RHYTHM_PARAMS: ParamDef[] = [
  { tag: "A", name: "LEVEL", kind: "int", min: 0, max: 100, default: 100 },
  { tag: "B", name: "REVERB", kind: "int", min: 0, max: 100, default: 0 },
  { tag: "E", name: "PATTERN", kind: "int", min: 0, max: 255, default: 0 },
  { tag: "F", name: "VARIATION", kind: "int", min: 0, max: 15, default: 0 },
  { tag: "G", name: "KIT", kind: "int", min: 0, max: 15, default: 0 },
  { tag: "J", name: "BEAT", kind: "int", min: 0, max: 15, default: 2 },
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
  if (def.name === "PAN") return panLabel(raw);
  if (def.kind === "enum") return enumLabel(def, raw);
  return String(raw);
}
