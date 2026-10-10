/** RC-600 rhythm part roles and bar fingerprints shared by the converter UI and the server suggestion. */
import type { PlayedBar } from "./scoreDrumEvents";

export const VARIATION_ROLES = ["varA", "varB", "varC", "varD"] as const;
export const FILL_ROLES = ["fillA", "fillB", "fillC", "fillD"] as const;
export const PART_ROLES = ["intro", ...VARIATION_ROLES, ...FILL_ROLES, "ending"] as const;

export type VariationRole = (typeof VARIATION_ROLES)[number];
export type FillRole = (typeof FILL_ROLES)[number];
export type PartRole = (typeof PART_ROLES)[number];

export const PART_LABELS: Record<PartRole, string> = {
  intro: "Intro",
  varA: "Variation A",
  varB: "Variation B",
  varC: "Variation C",
  varD: "Variation D",
  fillA: "Fill A",
  fillB: "Fill B",
  fillC: "Fill C",
  fillD: "Fill D",
  ending: "Ending",
};

export const PART_SHORT: Record<PartRole, string> = {
  intro: "In",
  varA: "A",
  varB: "B",
  varC: "C",
  varD: "D",
  fillA: "FA",
  fillB: "FB",
  fillC: "FC",
  fillD: "FD",
  ending: "End",
};

export type Confidence = "high" | "medium" | "low" | "manual";

export interface PartRange {
  role: PartRole;
  /** First played bar (inclusive). */
  start: number;
  /** Last played bar (exclusive). */
  end: number;
  confidence: Confidence;
  reason: string;
}

export type PartPlan = Partial<Record<PartRole, PartRange>>;

export function fillRoleFor(variation: VariationRole): FillRole {
  return FILL_ROLES[VARIATION_ROLES.indexOf(variation)]!;
}

export function variationRoleFor(fill: FillRole): VariationRole {
  return VARIATION_ROLES[FILL_ROLES.indexOf(fill)]!;
}

// ── Groove fingerprints ──────────────────────────────────────────

export type DrumClass = "kick" | "snare" | "hat" | "tom" | "cymbal" | "perc";

export function drumClass(note: number): DrumClass {
  if (note === 35 || note === 36) return "kick";
  if (note === 37 || note === 38 || note === 39 || note === 40) return "snare";
  if (note === 42 || note === 44 || note === 46) return "hat";
  if (note === 41 || note === 43 || note === 45 || note === 47 || note === 48 || note === 50) return "tom";
  if (note === 49 || note === 51 || note === 52 || note === 53 || note === 55 || note === 57 || note === 59) {
    return "cymbal";
  }
  return "perc";
}

/** Set of `class@step` on a 1/16 grid (velocity ignored). */
export function barFingerprint(bar: PlayedBar, ppq: number): Set<string> {
  const step = Math.max(1, ppq / 4);
  const out = new Set<string>();
  for (const h of bar.hits) {
    out.add(`${drumClass(h.note)}@${Math.round(h.tick / step)}`);
  }
  return out;
}

/**
 * For each bar, the index of the first bar with the same meter and the same drum notes on the
 * same 1/16 steps (velocity ignored); `count` is how often each first bar occurs.
 */
export function barRepeats(bars: readonly PlayedBar[], ppq: number): { firstOf: number[]; count: Map<number, number> } {
  const step = Math.max(1, ppq / 4);
  const seen = new Map<string, number>();
  const count = new Map<number, number>();
  const firstOf = bars.map((bar) => {
    const notes = [...new Set(bar.hits.map((h) => `${h.note}@${Math.round(h.tick / step)}`))].sort().join(",");
    const key = `${bar.numerator}/${bar.denominator}|${notes}`;
    const first = seen.get(key) ?? bar.index;
    if (!seen.has(key)) seen.set(key, bar.index);
    count.set(first, (count.get(first) ?? 0) + 1);
    return first;
  });
  return { firstOf, count };
}

export function similarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const k of a) if (b.has(k)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Runs of bars under the same section marker (label only; the server classifies them). */
export function sectionSegments(bars: readonly PlayedBar[]): { label: string | null; start: number; end: number }[] {
  const out: { label: string | null; start: number; end: number }[] = [];
  for (const bar of bars) {
    const last = out[out.length - 1];
    if (!last || bar.section) out.push({ label: bar.section ?? last?.label ?? null, start: bar.index, end: bar.index + 1 });
    else last.end = bar.index + 1;
  }
  return out;
}

export function partLength(part: Pick<PartRange, "start" | "end">): number {
  return Math.max(0, part.end - part.start);
}

/** Role shown on a timeline cell (first matching role in PART_ROLES order). */
export function roleAtBar(plan: PartPlan, bar: number): PartRole | null {
  for (const role of PART_ROLES) {
    const p = plan[role];
    if (p && bar >= p.start && bar < p.end) return role;
  }
  return null;
}
