/** Pure timing helpers for rhythm pad loops (testable, no Web Audio). */

export const TIME_SIGNATURES = ["4/4", "3/4", "6/8"] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export const DEFAULT_GLOBAL_BPM = 120;
export const DEFAULT_GLOBAL_METER: TimeSignature = "4/4";
/** Fixed 16th-note grid across one bar. */
export const STEPS_PER_BAR = 16;

export interface TimingConfig {
  bpm: number;
  meter: TimeSignature;
}

/** Per-pad overrides: blank/null BPM/meter inherit global; hitsPerBar is pad-local. */
export interface PadTimingOverride {
  bpm?: number | null;
  meter?: TimeSignature | null;
  /** How many hits evenly spaced in the 16-step bar (0–16). */
  hitsPerBar?: number;
}

export function isTimeSignature(value: string): value is TimeSignature {
  return (TIME_SIGNATURES as readonly string[]).includes(value);
}

/** Clamp BPM to a playable range. */
export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_GLOBAL_BPM;
  return Math.max(20, Math.min(300, Math.round(bpm)));
}

export function clampHitsPerBar(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(STEPS_PER_BAR, Math.round(n)));
}

/**
 * Pad BPM/meter win when set; blank/null falls back to global.
 * Empty string BPM is treated as unset.
 */
export function resolvePadTiming(
  global: TimingConfig,
  pad: PadTimingOverride | undefined,
): TimingConfig {
  const rawBpm = pad?.bpm;
  const hasBpm =
    rawBpm != null &&
    rawBpm !== ("" as unknown as number) &&
    Number.isFinite(Number(rawBpm)) &&
    Number(rawBpm) > 0;

  const meter = pad?.meter && isTimeSignature(pad.meter) ? pad.meter : global.meter;

  return {
    bpm: hasBpm ? clampBpm(Number(rawBpm)) : clampBpm(global.bpm),
    meter,
  };
}

/** Quarter-note beats per bar from the time signature numerator. */
export function beatsPerBar(meter: TimeSignature): number {
  const [num, den] = meter.split("/").map(Number) as [number, number];
  return (num * 4) / den;
}

/** Seconds for one full bar at bpm + meter. */
export function barDurationSec(timing: TimingConfig): number {
  return (beatsPerBar(timing.meter) * 60) / clampBpm(timing.bpm);
}

/** Seconds between adjacent steps of the 16-step grid. */
export function stepIntervalSec(timing: TimingConfig): number {
  return barDurationSec(timing) / STEPS_PER_BAR;
}

/** Seconds between quarter-note beats at the given BPM. */
export function beatIntervalSec(bpm: number): number {
  const b = clampBpm(bpm);
  return 60 / b;
}

/**
 * Evenly distribute `hits` triggers across a 16-step bar.
 * N=1 → [0]; N=2 → [0, 8]; N=4 → [0, 4, 8, 12].
 */
export function evenDistributeHits(hits: number, steps: number = STEPS_PER_BAR): number[] {
  const n = clampHitsPerBar(hits);
  if (n <= 0) return [];
  if (n >= steps) return Array.from({ length: steps }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.floor((i * steps) / n));
  }
  return out;
}

export function hitsToStepSet(hits: number, steps: number = STEPS_PER_BAR): Set<number> {
  return new Set(evenDistributeHits(hits, steps));
}

/** Parse an optional BPM input string → number | null (null = use global). */
export function parseOptionalBpm(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampBpm(n);
}
