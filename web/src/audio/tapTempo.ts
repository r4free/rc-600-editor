const TAP_WINDOW_MS = 3000;
const MAX_TAPS = 5;

/** Keeps the recent taps (ms timestamps) used for tap tempo, newest last. */
export function addTap(taps: readonly number[], now: number): number[] {
  return [...taps.filter((t) => now - t <= TAP_WINDOW_MS), now].slice(-MAX_TAPS);
}

/** Average BPM of the taps, clamped to `min`–`max`; `null` until there are two taps. */
export function tapTempoBpm(taps: readonly number[], min: number, max: number): number | null {
  if (taps.length < 2) return null;
  const average = (taps.at(-1)! - taps[0]!) / (taps.length - 1);
  if (average <= 0) return null;
  return Math.max(min, Math.min(max, Math.round(60_000 / average)));
}
