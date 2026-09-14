/**
 * Track FX type → RC0 block catalog (Parameter Guide Input FX/Track FX List + MEMORY*.RC0).
 * Shared types reuse the Input FX catalog; Beat Scatter / Repeat / Shift / Vinyl Flick are Track-only.
 */
import {
  INPUT_FX_BLOCK_SUFFIX,
  INPUT_FX_CATEGORIES,
  INPUT_FX_SEQ_PARAMS,
  INPUT_FX_SEQ_TYPES,
  inputFxCategory,
  inputFxDefaultSeqTags,
  inputFxDefaultTags,
  inputFxTypeParams,
  type InputFxCategory,
} from "./input-fx.js";
import { FX_BANKS, TRACK_FX_TYPE_OPTIONS, type EnumOption, type ParamDef } from "./params.js";

export { INPUT_FX_SEQ_PARAMS as TRACK_FX_SEQ_PARAMS };

/** RC0 block suffix per type index (THRU = null). Order matches TRACK_FX_TYPE_OPTIONS. */
export const TRACK_FX_BLOCK_SUFFIX: ReadonlyArray<string | null> = [
  ...INPUT_FX_BLOCK_SUFFIX,
  "BEAT_SCATTER",
  "BEAT_REPEAT",
  "BEAT_SHIFT",
  "VINYL_FLICK",
];

export const TRACK_FX_SEQ_TYPES = INPUT_FX_SEQ_TYPES;

export type TrackFxCategory = InputFxCategory | "Beat";

export const TRACK_FX_CATEGORIES: TrackFxCategory[] = [...INPUT_FX_CATEGORIES, "Beat"];

export function trackFxCategory(type: number): TrackFxCategory {
  if (type >= 52 && type <= 55) return "Beat";
  return inputFxCategory(type);
}

export function trackFxTypeLabel(type: number): string {
  return TRACK_FX_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? `Type ${type}`;
}

export function trackFxBlockName(type: number): string | null {
  if (type < 0 || type >= TRACK_FX_BLOCK_SUFFIX.length) return null;
  return TRACK_FX_BLOCK_SUFFIX[type] ?? null;
}

export function trackFxSection(bank: number, slot: number, type: number): string | null {
  const block = trackFxBlockName(type);
  if (!block) return null;
  return `${FX_BANKS[bank]!}${FX_BANKS[slot]!}_${block}`;
}

export function trackFxSeqSection(bank: number, slot: number, type: number): string | null {
  if (!TRACK_FX_SEQ_TYPES.has(type)) return null;
  const block = trackFxBlockName(type);
  if (!block) return null;
  return `${FX_BANKS[bank]!}${FX_BANKS[slot]!}_${block}_SEQ`;
}

function opts(...labels: string[]): EnumOption[] {
  return labels.map((label, value) => ({ value, label }));
}

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
): ParamDef {
  return p(tag, name, "int", { min, max, default: def, info });
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

/** THRU + note divisions (Parameter Guide LENGTH / SHIFT). Indices match factory RC0 defaults. */
const BEAT_LENGTH: EnumOption[] = [
  { value: 0, label: "THRU" },
  { value: 1, label: "4MEAS" },
  { value: 2, label: "2MEAS" },
  { value: 3, label: "1MEAS" },
  { value: 4, label: "1/2" },
  { value: 5, label: "1/4" },
  { value: 6, label: "1/8" },
  { value: 7, label: "1/16" },
  { value: 8, label: "1/32" },
  { value: 9, label: "1/2T" },
  { value: 10, label: "1/4T" },
  { value: 11, label: "1/8T" },
  { value: 12, label: "1/16T" },
  { value: 13, label: "1/2." },
  { value: 14, label: "1/4." },
  { value: 15, label: "1/8." },
];

const BEAT_SCATTER_PARAMS: ParamDef[] = [
  enumP("A", "Type", opts("P1", "P2", "P3", "P4"), 2, "Sets the type of scrub playback."),
  enumP("B", "Length", BEAT_LENGTH, 4, "Sets the length of scrub playback."),
];

const BEAT_REPEAT_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Type",
    opts("FORWARD", "REWIND", "MIX"),
    1,
    "Direction of repeat playback. FORWARD plays forward, REWIND reverse, MIX alternates.",
  ),
  enumP("B", "Length", BEAT_LENGTH, 8, "Sets the repeat length."),
];

const BEAT_SHIFT_PARAMS: ParamDef[] = [
  enumP(
    "A",
    "Type",
    opts("FUTURE", "PAST"),
    0,
    "Direction in which the playback position will be shifted.",
  ),
  enumP("B", "Shift", BEAT_LENGTH, 6, "Amount by which the playback position will be shifted."),
];

const VINYL_FLICK_PARAMS: ParamDef[] = [
  intP("A", "Flick", 0, 100, 50, "Sets the playback speed of the turntable."),
];

const TRACK_ONLY_PARAMS: Record<number, ParamDef[]> = {
  52: BEAT_SCATTER_PARAMS,
  53: BEAT_REPEAT_PARAMS,
  54: BEAT_SHIFT_PARAMS,
  55: VINYL_FLICK_PARAMS,
};

export function trackFxTypeParams(type: number): ParamDef[] {
  return TRACK_ONLY_PARAMS[type] ?? inputFxTypeParams(type);
}

export function trackFxDefaultTags(type: number): Record<string, string> {
  const extras = TRACK_ONLY_PARAMS[type];
  if (extras) {
    const out: Record<string, string> = {};
    for (const def of extras) {
      if (def.default !== undefined) out[def.tag] = String(def.default);
    }
    return out;
  }
  return inputFxDefaultTags(type);
}

export function trackFxDefaultSeqTags(): Record<string, string> {
  return inputFxDefaultSeqTags();
}
