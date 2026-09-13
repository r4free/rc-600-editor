import { assignSourceMidiCc, RHYTHM_KITS } from "./params.js";
import { ASSIGN_TARGETS } from "./assign-targets.js";

export const RHYTHM_KIT_COUNT = RHYTHM_KITS.length;
/** Fallback CC when the current memory has no Rhythm Kit assign (CC#02). */
export const DEFAULT_RHYTHM_KIT_CC = 2;

export interface RhythmKitMidiAssign {
  cc: number;
  actLow: number;
  actHigh: number;
  targetMin: number;
  targetMax: number;
}

const DEFAULT_ASSIGN: RhythmKitMidiAssign = {
  cc: DEFAULT_RHYTHM_KIT_CC,
  actLow: 0,
  actHigh: 127,
  targetMin: 0,
  targetMax: RHYTHM_KIT_COUNT - 1,
};

export function rhythmKitTargetValue(): number {
  const target = ASSIGN_TARGETS.find((t) => t.label === "Rhythm Kit");
  if (target == null) throw new Error("Rhythm Kit assign target is missing");
  return target.value;
}

export function clampKitIndex(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(RHYTHM_KIT_COUNT - 1, Math.round(value)));
}

/** Assign-compatible CC numbers: 1–31 and 64–95. */
export function clampRhythmKitCc(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RHYTHM_KIT_CC;
  const n = Math.round(value);
  if (n >= 1 && n <= 31) return n;
  if (n >= 64 && n <= 95) return n;
  return DEFAULT_RHYTHM_KIT_CC;
}

function num(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function findRhythmKitAssign(
  assigns: readonly Record<string, string | undefined>[],
): RhythmKitMidiAssign | null {
  const kitTarget = rhythmKitTargetValue();
  for (const tags of assigns) {
    if (num(tags.A, 0) !== 1) continue;
    if (num(tags.G, -1) !== kitTarget) continue;
    const cc = assignSourceMidiCc(num(tags.B, -1));
    if (cc == null) continue;
    return {
      cc,
      actLow: num(tags.D, 0),
      actHigh: num(tags.F, 127),
      targetMin: num(tags.H, 0),
      targetMax: num(tags.I, RHYTHM_KIT_COUNT - 1),
    };
  }
  return null;
}

export function resolveRhythmKitAssign(
  assigns: readonly Record<string, string | undefined>[] | null | undefined,
  fallbackCc = DEFAULT_RHYTHM_KIT_CC,
): RhythmKitMidiAssign {
  const found = assigns ? findRhythmKitAssign(assigns) : null;
  if (found) return found;
  return { ...DEFAULT_ASSIGN, cc: clampRhythmKitCc(fallbackCc) };
}

/**
 * CC value that selects `kit` given Assign Act Low/High and Target Min/Max.
 * Default 0–127 over kits 0–15 matches a factory-range Rhythm Kit assign.
 */
export function kitIndexToCcValue(
  kit: number,
  assign: Pick<RhythmKitMidiAssign, "actLow" | "actHigh" | "targetMin" | "targetMax"> = DEFAULT_ASSIGN,
): number {
  const k = clampKitIndex(kit);
  const tSpan = assign.targetMax - assign.targetMin;
  if (tSpan === 0) return Math.max(0, Math.min(127, Math.round(assign.actLow)));
  const tLo = Math.min(assign.targetMin, assign.targetMax);
  const tHi = Math.max(assign.targetMin, assign.targetMax);
  const t = Math.min(tHi, Math.max(tLo, k));
  const ratio = (t - assign.targetMin) / tSpan;
  return Math.max(0, Math.min(127, Math.round(assign.actLow + ratio * (assign.actHigh - assign.actLow))));
}
