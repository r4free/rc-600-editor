/** Compact JSON form of played drum bars for `/api/rhythm/*` requests. */
import type { PlayedBar } from "./scoreDrumEvents";

/** `[numerator, denominator, lengthTicks, tempo, section, [tick, note, velocity, …]]` */
export type WireBar = [number, number, number, number, string | null, number[]];

export function barsToWire(bars: readonly PlayedBar[]): WireBar[] {
  return bars.map((b) => [
    b.numerator,
    b.denominator,
    b.lengthTicks,
    b.tempo,
    b.section,
    b.hits.flatMap((h) => [h.tick, h.note, h.velocity]),
  ]);
}

export function barsFromWire(raw: unknown): PlayedBar[] {
  if (!Array.isArray(raw)) throw new Error("Invalid bars.");
  return raw.map((b, index): PlayedBar => {
    if (!Array.isArray(b) || b.length < 6 || !Array.isArray(b[5])) throw new Error("Invalid bars.");
    const [numerator, denominator, lengthTicks, tempo, section, flat] = b as WireBar;
    const hits = [];
    for (let i = 0; i + 2 < flat.length; i += 3) {
      hits.push({ tick: Number(flat[i]), note: Number(flat[i + 1]), velocity: Number(flat[i + 2]) });
    }
    return {
      index,
      masterBarIndex: index,
      numerator: Number(numerator),
      denominator: Number(denominator),
      lengthTicks: Number(lengthTicks),
      tempo: Number(tempo),
      section: typeof section === "string" ? section : null,
      hits,
    };
  });
}
