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

/** Per-pad overrides: blank/null BPM/meter/velocity inherit global; hitsPerBar is pad-local. */
export interface PadTimingOverride {
  bpm?: number | null;
  meter?: TimeSignature | null;
  /** How many hits evenly spaced in the 16-step bar (0–16). */
  hitsPerBar?: number;
  /** 1–127, or null/omit to use the global Vel. */
  velocity?: number | null;
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

export function clampVelocity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(1, Math.min(127, Math.round(value)));
}

/** null = inherit the global Vel. */
export function parseOptionalPadVelocity(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clampVelocity(n);
}

export function resolvePadVelocity(
  globalVelocity: number,
  pad: PadTimingOverride | undefined,
): number {
  const local = pad?.velocity;
  if (local == null || !Number.isFinite(Number(local))) return clampVelocity(globalVelocity);
  return clampVelocity(Number(local));
}

/**
 * Kit mix vs the global Vel: kick/snare sit forward, hats sit back.
 * Busy 16th hats come down a little more so they do not bury the groove.
 */
export function padVelocityGainForNote(note: number): number {
  const n = Math.round(note);
  if (n === 35 || n === 36) return 1.14;
  if (n === 38 || n === 40) return 1.06;
  if (n === 39) return 1.0;
  if (n === 37) return 0.84;
  if (n === 42) return 0.7;
  if (n === 46) return 0.82;
  if (n === 44) return 0.62;
  if (n === 41 || n === 43 || n === 45 || n === 47 || n === 48 || n === 50) return 0.92;
  if (n === 49 || n === 57) return 1.02;
  if (n === 51 || n === 59) return 0.86;
  if (n === 52 || n === 53 || n === 55) return 0.9;
  if (n === 56 || n === 54) return 0.78;
  return 0.88;
}

export function mixPadVelocity(globalVelocity: number, note: number, hitsPerBar = 0): number {
  let gain = padVelocityGainForNote(note);
  if (hitsPerBar >= 12) gain *= 0.9;
  return clampVelocity(clampVelocity(globalVelocity) * gain);
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
