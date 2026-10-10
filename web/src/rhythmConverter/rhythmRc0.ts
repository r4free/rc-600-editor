/**
 * RC-600 user rhythm slots (`ROLAND/DATA/RHYTHM.RC0`). The binary format is read and written by the
 * server (`/api/rhythm/*`); the browser only keeps each slot's opaque bytes plus its decoded summary.
 */
import type { PartEvents } from "./exportPack";
import { SMF_PPQ } from "./smf";

export const RHYTHM_RC0_PATH = "DATA/RHYTHM.RC0";
export const MAX_USER_PATTERNS = 50;
export const PATTERN_NAME_MAX = 12;

/** One user rhythm slot as returned by the server. */
export interface SlotRecord {
  /** Raw record bytes (base64, trailing zeros trimmed). Sent back unchanged so slots round-trip exactly. */
  data: string;
  name: string;
  kit: number;
  tempo: number;
  numerator: number;
  denominator: number;
  totalBars: number;
  /** Parts the pedal plays (windows that only repeat another part are left out). */
  parts: PartEvents[];
}

export function sanitizePatternName(raw: string): string {
  const ascii = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^ -~]/g, "?")
    .trim();
  return ascii.slice(0, PATTERN_NAME_MAX) || "USER";
}

/** Replace `index` (or append when null/out of range). Returns the new list and the slot used. */
export function upsertRecord(
  records: readonly SlotRecord[],
  record: SlotRecord,
  index: number | null,
): { records: SlotRecord[]; index: number } {
  const next = [...records];
  if (index != null && index >= 0 && index < next.length) {
    next[index] = record;
    return { records: next, index };
  }
  if (next.length >= MAX_USER_PATTERNS)
    throw new Error(`All ${MAX_USER_PATTERNS} user rhythm slots are used. Pick one to replace.`);
  next.push(record);
  return { records: next, index: next.length - 1 };
}

/** Puts each record in the slot with the same name, or the next free slot. */
export function mergeRecordsByName(
  records: readonly SlotRecord[],
  incoming: readonly SlotRecord[],
): { records: SlotRecord[]; slots: { name: string; index: number; replaced: boolean }[] } {
  let next = [...records];
  const slots: { name: string; index: number; replaced: boolean }[] = [];
  for (const record of incoming) {
    const existing = next.findIndex((r) => r.name.toLowerCase() === record.name.toLowerCase());
    const res = upsertRecord(next, record, existing >= 0 ? existing : null);
    next = res.records;
    slots.push({ name: record.name, index: res.index, replaced: existing >= 0 });
  }
  return { records: next, slots };
}

/** Fills are one bar on the RC-600: keep the last bar of a longer fill. */
export function lastBarOnly(ev: PartEvents): PartEvents {
  if (ev.bars <= 1) return ev;
  const bar = Math.round((ev.numerator * SMF_PPQ * 4) / ev.denominator);
  const start = Math.max(0, ev.lengthTicks - bar);
  return {
    ...ev,
    notes: ev.notes.filter((n) => n.tick >= start).map((n) => ({ ...n, tick: n.tick - start })),
    lengthTicks: ev.lengthTicks - start,
    bars: 1,
  };
}

/** Meter covering the most bars across `parts`. */
export function patternMeter(parts: readonly PartEvents[]): [number, number] {
  const weight = new Map<string, number>();
  for (const p of parts) {
    const key = `${p.numerator}/${p.denominator}`;
    weight.set(key, (weight.get(key) ?? 0) + p.bars);
  }
  let best = "4/4";
  let bestWeight = -1;
  for (const [key, w] of weight) {
    if (w > bestWeight) {
      best = key;
      bestWeight = w;
    }
  }
  return best.split("/").map(Number) as [number, number];
}
