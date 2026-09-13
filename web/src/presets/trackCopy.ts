import { TRACK_PARAMS } from "@rc600/catalog/params";
import type { TagMap } from "@rc600/rc0/memory";

const TRACK_COPY_TAGS = new Set([...TRACK_PARAMS.map((p) => p.tag), "Q"]);

/** Editable track settings only (TRACK_PARAMS + input bitmask Q). Never phrase V/X. */
export function trackCopyTags(track: TagMap): TagMap {
  const out: TagMap = {};
  for (const tag of TRACK_COPY_TAGS) {
    if (track[tag] !== undefined) out[tag] = track[tag]!;
  }
  return out;
}

export type MemoryRange = { from: number; to: number };

function clampSlot(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  if (v < 1 || v > 99) return null;
  return v;
}

/** Expand up to two inclusive memory ranges into unique sorted slots (1–99). Invalid ranges skipped. */
export function expandMemoryRanges(ranges: Array<MemoryRange | null | undefined>): number[] {
  const set = new Set<number>();
  for (const r of ranges) {
    if (!r) continue;
    const from = clampSlot(r.from);
    const to = clampSlot(r.to);
    if (from == null || to == null || from > to) continue;
    for (let s = from; s <= to; s++) set.add(s);
  }
  return [...set].sort((a, b) => a - b);
}
