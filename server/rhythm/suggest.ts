/** Suggests RC-600 rhythm parts (Intro, Variations A–D, Fills A–D, Ending) from played drum bars. */
import type { PlayedBar } from "../../web/src/rhythmConverter/scoreDrumEvents.js";
import {
  FILL_ROLES,
  PART_ROLES,
  VARIATION_ROLES,
  barFingerprint,
  drumClass,
  fillRoleFor,
  similarity,
  type Confidence,
  type PartPlan,
  type PartRange,
  type PartRole,
  type VariationRole,
} from "../../web/src/rhythmConverter/sectionSuggest.js";

const MAX_INTRO_BARS = 8;
const MAX_ENDING_BARS = 4;
const LOOP_LENGTHS = [1, 2, 4, 8] as const;
const SAME_GROOVE = 0.8;
const FILL_THRESHOLD = 0.6;

function fillScore(bar: PlayedBar): number {
  let score = 0;
  for (const h of bar.hits) {
    const c = drumClass(h.note);
    if (c === "tom") score += 2;
    else if (c === "snare") score += 1;
  }
  return score;
}

/** Shortest repeating unit (1/2/4/8 bars) starting at `start` within `[start, end)`. */
export function loopLength(prints: readonly Set<string>[], start: number, end: number): number {
  const available = end - start;
  for (const len of LOOP_LENGTHS) {
    if (len > available) break;
    if (len * 2 > available) return len;
    let ok = 0;
    let total = 0;
    for (let i = start; i + len < end; i++) {
      total++;
      if (similarity(prints[i]!, prints[i + len]!) >= SAME_GROOVE) ok++;
    }
    if (total > 0 && ok / total >= 0.75) return len;
  }
  return Math.min(available, LOOP_LENGTHS[LOOP_LENGTHS.length - 1]);
}

// ── Section markers ──────────────────────────────────────────────

export type SectionKind = "intro" | "verse" | "pre" | "chorus" | "bridge" | "solo" | "fill" | "ending" | "other";

export function classifySection(label: string | null): SectionKind {
  if (!label) return "other";
  const s = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/intro/.test(s)) return "intro";
  if (/outro|ending|\bend\b|final|coda|\bfim\b/.test(s)) return "ending";
  if (/pre[\s-]?(chorus|refrao)/.test(s)) return "pre";
  if (/chorus|refrao|refrain|hook|\bcoro\b/.test(s)) return "chorus";
  if (/verse|verso|estrofe|stanza|couplet/.test(s)) return "verse";
  if (/bridge|ponte|middle ?8|interlud|interludio/.test(s)) return "bridge";
  if (/solo/.test(s)) return "solo";
  if (/fill|virada|break|conven/.test(s)) return "fill";
  return "other";
}

const KIND_SLOT: Partial<Record<SectionKind, VariationRole>> = {
  verse: "varA",
  chorus: "varB",
  bridge: "varC",
  pre: "varD",
  solo: "varD",
  other: "varD",
};

interface Segment {
  label: string | null;
  kind: SectionKind;
  start: number;
  end: number;
}

export function sectionSegments(bars: readonly PlayedBar[]): Segment[] {
  const out: Segment[] = [];
  for (const bar of bars) {
    const last = out[out.length - 1];
    if (!last || bar.section) {
      const label = bar.section ?? last?.label ?? null;
      out.push({ label, kind: classifySection(label), start: bar.index, end: bar.index + 1 });
    } else {
      last.end = bar.index + 1;
    }
  }
  return out;
}

// ── Suggestion ───────────────────────────────────────────────────

function firstHitBar(bars: readonly PlayedBar[], from = 0): number {
  for (let i = from; i < bars.length; i++) if (bars[i]!.hits.length) return i;
  return bars.length;
}

function lastHitBar(bars: readonly PlayedBar[]): number {
  for (let i = bars.length - 1; i >= 0; i--) if (bars[i]!.hits.length) return i;
  return -1;
}

/** Splits a section into its loop and an optional closing fill bar. */
function analyseSegment(
  bars: readonly PlayedBar[],
  prints: readonly Set<string>[],
  seg: Segment,
): { loop: [number, number]; fill: number | null } | null {
  const start = firstHitBar(bars, seg.start);
  let end = seg.end;
  while (end > start && !bars[end - 1]!.hits.length) end--;
  if (start >= end) return null;
  let fill: number | null = null;
  if (end - start >= 2) {
    const last = end - 1;
    const body = prints.slice(start, last);
    const best = Math.max(...body.map((p) => similarity(p, prints[last]!)));
    const busier = fillScore(bars[last]!) > fillScore(bars[start]!);
    if (best < FILL_THRESHOLD || (best < SAME_GROOVE && busier)) fill = last;
  }
  const bodyEnd = fill ?? end;
  const len = loopLength(prints, start, bodyEnd);
  return { loop: [start, start + len], fill };
}

function range(
  role: PartRole,
  start: number,
  end: number,
  confidence: Confidence,
  reason: string,
): PartRange {
  return { role, start, end, confidence, reason };
}

function suggestFromMarkers(
  bars: readonly PlayedBar[],
  prints: readonly Set<string>[],
  segments: readonly Segment[],
): PartPlan {
  const plan: PartPlan = {};
  const loops: Set<string>[] = [];
  const first = segments[0];
  if (first?.kind === "intro") {
    const s = firstHitBar(bars, first.start);
    const e = Math.min(first.end, s + MAX_INTRO_BARS);
    if (s < e) plan.intro = range("intro", s, e, "high", `Section "${first.label}"`);
  }
  const lastSeg = segments[segments.length - 1];
  if (lastSeg && lastSeg !== first && lastSeg.kind === "ending") {
    const e = lastHitBar(bars) + 1;
    const s = Math.max(lastSeg.start, e - MAX_ENDING_BARS);
    if (s < e) plan.ending = range("ending", s, e, "high", `Section "${lastSeg.label}"`);
  }

  for (const seg of segments) {
    if (seg.kind === "intro" || seg.kind === "ending" || seg.kind === "fill") continue;
    const analysed = analyseSegment(bars, prints, seg);
    if (!analysed) continue;
    const loopPrint = prints[analysed.loop[0]]!;
    if (loops.some((p) => similarity(p, loopPrint) >= SAME_GROOVE)) continue;
    const preferred = KIND_SLOT[seg.kind] ?? "varD";
    const slot = plan[preferred]
      ? VARIATION_ROLES.find((r) => !plan[r])
      : preferred;
    if (!slot) break;
    loops.push(loopPrint);
    plan[slot] = range(slot, analysed.loop[0], analysed.loop[1], "high", `Section "${seg.label}"`);
    const fillRole = fillRoleFor(slot);
    if (analysed.fill != null) {
      plan[fillRole] = range(fillRole, analysed.fill, analysed.fill + 1, "high", `End of "${seg.label}"`);
    } else {
      const next = segments[segments.indexOf(seg) + 1];
      if (next?.kind === "fill") {
        const s = firstHitBar(bars, next.start);
        if (s < next.end) plan[fillRole] = range(fillRole, s, s + 1, "high", `Section "${next.label}"`);
      }
    }
  }
  return plan;
}

function suggestFromGrooves(bars: readonly PlayedBar[], prints: readonly Set<string>[]): PartPlan {
  const plan: PartPlan = {};
  const clusters: { print: Set<string>; bars: number[] }[] = [];
  const clusterOf: number[] = bars.map(() => -1);
  for (const bar of bars) {
    if (!bar.hits.length) continue;
    const p = prints[bar.index]!;
    let found = clusters.findIndex((c) => similarity(c.print, p) >= SAME_GROOVE);
    if (found < 0) {
      found = clusters.length;
      clusters.push({ print: p, bars: [] });
    }
    clusters[found]!.bars.push(bar.index);
    clusterOf[bar.index] = found;
  }
  const grooves = clusters
    .map((c, id) => ({ ...c, id }))
    .filter((c) => c.bars.some((b, i) => i > 0 && b - c.bars[i - 1]! <= 2))
    .sort((a, b) => b.bars.length - a.bars.length)
    .slice(0, VARIATION_ROLES.length)
    .sort((a, b) => a.bars[0]! - b.bars[0]!);
  const grooveIds = new Set(grooves.map((g) => g.id));

  grooves.forEach((g, i) => {
    const role = VARIATION_ROLES[i]!;
    const start = g.bars[0]!;
    let runEnd = start;
    while (runEnd < bars.length && grooveIds.has(clusterOf[runEnd]!)) runEnd++;
    const len = loopLength(prints, start, runEnd);
    plan[role] = range(role, start, start + len, "medium", `Groove repeated ${g.bars.length}×`);
    const fillBar = g.bars
      .map((b) => b + 1)
      .find((b) => b < bars.length && bars[b]!.hits.length && !grooveIds.has(clusterOf[b]!));
    if (fillBar != null) {
      const fr = fillRoleFor(role);
      plan[fr] = range(fr, fillBar, fillBar + 1, "medium", "Bar that breaks the groove");
    }
  });

  const firstGroove = grooves.length ? Math.min(...grooves.map((g) => g.bars[0]!)) : bars.length;
  const introStart = firstHitBar(bars);
  if (introStart < firstGroove) {
    plan.intro = range(
      "intro",
      introStart,
      Math.min(firstGroove, introStart + MAX_INTRO_BARS),
      "medium",
      "Bars before the main groove",
    );
  }
  const last = lastHitBar(bars);
  if (last >= 0) {
    const lastGroove = grooves.length ? Math.max(...grooves.flatMap((g) => g.bars)) : -1;
    const fills = new Set(FILL_ROLES.map((r) => plan[r]?.start));
    if (last > lastGroove && !fills.has(last)) {
      let s = Math.max(lastGroove + 1, last + 1 - MAX_ENDING_BARS);
      while (s < last && fills.has(s)) s++;
      plan.ending = range("ending", s, last + 1, "medium", "Bars after the last groove");
    } else {
      plan.ending = range("ending", last, last + 1, "low", "Last bar of the song");
    }
  }
  return plan;
}

/** Hybrid suggestion: section markers when present, groove clustering otherwise. */
export function suggestParts(bars: readonly PlayedBar[], ppq: number): PartPlan {
  if (!bars.some((b) => b.hits.length)) return {};
  const prints = bars.map((b) => barFingerprint(b, ppq));
  const segments = sectionSegments(bars);
  const hasMarkers = bars.some((b) => b.section);
  const plan = hasMarkers ? suggestFromMarkers(bars, prints, segments) : {};
  if (!VARIATION_ROLES.some((r) => plan[r])) {
    const grooves = suggestFromGrooves(bars, prints);
    for (const role of PART_ROLES) if (!plan[role] && grooves[role]) plan[role] = grooves[role];
  }
  if (!VARIATION_ROLES.some((r) => plan[r])) {
    const s = firstHitBar(bars);
    plan.varA = range("varA", s, s + 1, "low", "First bar with drums");
  }
  return plan;
}
