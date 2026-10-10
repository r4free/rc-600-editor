/**
 * Magic Wand: classifies the song's bars into grooves, fills, intro and ending, then builds up to
 * eight ways to fill the RC-600 parts (Intro, Variation A–D, Fill A–D, Ending), best first.
 */
import type { PlayedBar } from "../../web/src/rhythmConverter/scoreDrumEvents.js";
import {
  FILL_ROLES,
  PART_ROLES,
  VARIATION_ROLES,
  barFingerprint,
  drumClass,
  fillRoleFor,
  similarity,
  type PartPlan,
  type PartRange,
} from "../../web/src/rhythmConverter/sectionSuggest.js";
import { classifySection, loopLength, suggestParts } from "./suggest.js";

export const AUTO_MAP_MAX = 8;
const SAME_GROOVE = 0.8;
const MAX_INTRO_BARS = 8;
const MAX_ENDING_BARS = 4;

export interface AutoMapOption {
  plan: PartPlan;
  score: number;
  /** Short description, e.g. "3 variations · 3 fills · intro 4 bars · ending 1 bar". */
  summary: string;
}

interface Groove {
  id: number;
  bars: number[];
  print: Set<string>;
  /** Start of the longest run of this groove and its repeating loop length. */
  start: number;
  loop: number;
  runEnd: number;
}

interface FillCandidate {
  bar: number;
  /** Groove played right before the fill. */
  groove: number;
  quality: number;
}

interface Analysis {
  bars: readonly PlayedBar[];
  prints: Set<string>[];
  hitBars: number[];
  clusterOf: number[];
  grooves: Groove[];
  fills: FillCandidate[];
  intro: [number, number] | null;
  ending: [number, number] | null;
}

function fillWeight(bar: PlayedBar): number {
  let toms = 0;
  let snares = 0;
  for (const h of bar.hits) {
    const c = drumClass(h.note);
    if (c === "tom") toms++;
    else if (c === "snare") snares++;
  }
  return Math.min(1, (toms * 2 + snares) / 12);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function analyse(bars: readonly PlayedBar[], ppq: number): Analysis {
  const prints = bars.map((b) => barFingerprint(b, ppq));
  const hitBars = bars.filter((b) => b.hits.length).map((b) => b.index);
  const clusters: { print: Set<string>; bars: number[] }[] = [];
  const clusterOf = bars.map(() => -1);
  for (const i of hitBars) {
    let found = clusters.findIndex((c) => similarity(c.print, prints[i]!) >= SAME_GROOVE);
    if (found < 0) {
      found = clusters.length;
      clusters.push({ print: prints[i]!, bars: [] });
    }
    clusters[found]!.bars.push(i);
    clusterOf[i] = found;
  }

  // A groove repeats close to itself; one-off bars are fills, intro or ending material.
  const grooveIds = new Set(
    clusters
      .map((c, id) => ({ c, id }))
      .filter(({ c }) => c.bars.length >= 2 && c.bars.some((b, i) => i > 0 && b - c.bars[i - 1]! <= 2))
      .map(({ id }) => id),
  );
  // A pattern played only once, in a single run at the very start or end, is the intro or ending.
  const firstHit = hitBars[0] ?? 0;
  const lastHit = hitBars[hitBars.length - 1] ?? 0;
  const biggest = Math.max(0, ...[...grooveIds].map((id) => clusters[id]!.bars.length));
  for (const id of [...grooveIds]) {
    const b = clusters[id]!.bars;
    const oneRun = b[b.length - 1]! - b[0]! === b.length - 1;
    const atEdge = b[0] === firstHit || b[b.length - 1] === lastHit;
    if (oneRun && atEdge && b.length < biggest && grooveIds.size > 1) grooveIds.delete(id);
  }
  const inGroove = (i: number) => i >= 0 && i < bars.length && grooveIds.has(clusterOf[i]!);
  const grooves: Groove[] = [...grooveIds].map((id) => {
    const c = clusters[id]!;
    let best = { start: c.bars[0]!, end: c.bars[0]! + 1 };
    for (const b of c.bars) {
      if (b > 0 && clusterOf[b - 1] === id) continue;
      let end = b;
      while (end < bars.length && (clusterOf[end] === id || (inGroove(end) && end - b < 8))) end++;
      if (end - b > best.end - best.start) best = { start: b, end };
    }
    return {
      id,
      bars: c.bars,
      print: c.print,
      start: best.start,
      runEnd: best.end,
      loop: loopLength(prints, best.start, best.end),
    };
  });
  grooves.sort((a, b) => b.bars.length - a.bars.length || a.start - b.start);

  const fills: FillCandidate[] = [];
  for (const i of hitBars) {
    if (inGroove(i) || i === 0 || !inGroove(i - 1)) continue;
    const before = clusterOf[i - 1]!;
    const sim = Math.max(...grooves.map((g) => similarity(g.print, prints[i]!)));
    const sectionChange = Boolean(bars[i + 1]?.section) || (i + 1 < bars.length && clusterOf[i + 1] !== before);
    fills.push({
      bar: i,
      groove: before,
      quality: (1 - sim) * 0.6 + fillWeight(bars[i]!) * 0.6 + (sectionChange ? 0.3 : 0),
    });
  }
  fills.sort((a, b) => b.quality - a.quality);

  const first = hitBars[0];
  const last = hitBars[hitBars.length - 1];
  let intro: [number, number] | null = null;
  let ending: [number, number] | null = null;
  if (first != null && last != null) {
    const introMarker = bars.findIndex((b) => b.section && classifySection(b.section) === "intro");
    const firstGroove = grooves.length ? Math.min(...grooves.map((g) => g.bars[0]!)) : bars.length;
    const nextSection = bars.findIndex((b, i) => i > introMarker && b.section);
    const introEnd = introMarker >= 0 && nextSection >= 0 ? nextSection : firstGroove;
    if (first < introEnd) intro = [first, Math.min(introEnd, first + MAX_INTRO_BARS)];
    const lastGroove = grooves.length ? Math.max(...grooves.flatMap((g) => g.bars)) : -1;
    let endingMarker = -1;
    for (let i = bars.length - 1; i >= 0 && endingMarker < 0; i--) {
      if (bars[i]!.section && classifySection(bars[i]!.section) === "ending") endingMarker = i;
    }
    const endStart = endingMarker > 0 ? endingMarker : lastGroove + 1;
    if (last >= endStart) ending = [Math.max(endStart, last + 1 - MAX_ENDING_BARS), last + 1];
    else ending = [last, last + 1];
  }
  return { bars, prints, hitBars, clusterOf, grooves, fills, intro, ending };
}

interface Recipe {
  variations: number;
  /** Assign Variation A–D in song order (true) or by how often each groove plays (false). */
  songOrder: boolean;
  longLoops: boolean;
  /** 0 = best fill after each groove, 1 = second best. */
  fillPick: 0 | 1;
  shortIntro: boolean;
  shortEnding: boolean;
}

function range(role: PartRange["role"], start: number, end: number, reason: string): PartRange {
  return { role, start, end, confidence: "medium", reason };
}

function buildPlan(a: Analysis, r: Recipe): PartPlan {
  const plan: PartPlan = {};
  const loopLen = (g: Groove) => (r.longLoops && g.loop * 2 <= Math.min(8, g.runEnd - g.start) ? g.loop * 2 : g.loop);
  // A groove that sits inside another groove's loop is part of that loop, not a variation of its own.
  const picked: Groove[] = [];
  for (const g of a.grooves) {
    if (picked.length >= r.variations) break;
    const end = g.start + loopLen(g);
    if (picked.some((p) => g.start < p.start + loopLen(p) && p.start < end)) continue;
    if (
      picked.some(
        (p) =>
          p.loop > 1 &&
          a.prints.slice(p.start, p.start + loopLen(p)).some((x) => similarity(x, g.print) >= SAME_GROOVE),
      )
    ) {
      continue;
    }
    picked.push(g);
  }
  if (r.songOrder) picked.sort((x, y) => x.bars[0]! - y.bars[0]!);
  const used = new Set<number>();
  const edge = (bar: number) =>
    (a.intro != null && bar >= a.intro[0] && bar < a.intro[1]) ||
    (a.ending != null && bar >= a.ending[0] && bar < a.ending[1]);
  for (const f of a.fills) if (edge(f.bar)) used.add(f.bar);
  picked.forEach((g, i) => {
    const role = VARIATION_ROLES[i]!;
    plan[role] = range(role, g.start, g.start + loopLen(g), `Groove played ${g.bars.length}×`);
    const options = a.fills.filter((f) => f.groove === g.id && !used.has(f.bar));
    const fill = options[Math.min(r.fillPick, options.length - 1)];
    if (fill) {
      used.add(fill.bar);
      const fr = fillRoleFor(role);
      plan[fr] = range(fr, fill.bar, fill.bar + 1, "Bar that breaks this groove");
    }
  });
  // Variations whose groove has no fill of its own borrow the best unused break.
  for (const role of VARIATION_ROLES) {
    const fr = fillRoleFor(role);
    if (!plan[role] || plan[fr]) continue;
    const spare = a.fills.find((f) => !used.has(f.bar));
    if (!spare) break;
    used.add(spare.bar);
    plan[fr] = range(fr, spare.bar, spare.bar + 1, "Strongest unused break");
  }
  if (a.intro) {
    const [s, e] = a.intro;
    const start = r.shortIntro && e - s > 2 ? e - 2 : s;
    plan.intro = range("intro", start, e, "Bars before the first groove");
  }
  if (a.ending) {
    const [s, e] = a.ending;
    const start = r.shortEnding && e - s > 1 ? e - 1 : s;
    plan.ending = range("ending", start, e, "Bars after the last groove");
  }
  return plan;
}

function scorePlan(a: Analysis, plan: PartPlan): number {
  const loops = VARIATION_ROLES.map((r) => plan[r]).filter((p): p is PartRange => Boolean(p));
  if (!loops.length || !a.hitBars.length) return 0;
  const loopPrints = loops.flatMap((p) => a.prints.slice(p.start, p.end));
  let covered = 0;
  for (const i of a.hitBars) if (loopPrints.some((p) => similarity(p, a.prints[i]!) >= SAME_GROOVE)) covered++;
  let score = (covered / a.hitBars.length) * 4;
  for (let i = 0; i < loops.length; i++) {
    for (let j = i + 1; j < loops.length; j++) {
      if (similarity(a.prints[loops[i]!.start]!, a.prints[loops[j]!.start]!) >= SAME_GROOVE) score -= 0.6;
    }
    const plays = a.hitBars.filter((b) => similarity(a.prints[b]!, a.prints[loops[i]!.start]!) >= SAME_GROOVE).length;
    if (plays < 3) score -= 0.35;
    const len = loops[i]!.end - loops[i]!.start;
    if (len === 2 || len === 4) score += 0.15;
    for (let j = i + 1; j < loops.length; j++) {
      if (loops[i]!.start < loops[j]!.end && loops[j]!.start < loops[i]!.end) score -= 1;
    }
  }
  for (const fr of FILL_ROLES) {
    const f = plan[fr];
    if (!f) continue;
    score += 0.25 + 0.3 * (a.fills.find((c) => c.bar === f.start)?.quality ?? 0.2);
  }
  if (plan.intro) score += 0.3 + Math.min(0.2, (plan.intro.end - plan.intro.start) * 0.05);
  if (plan.ending) score += plan.ending.end - plan.ending.start > 1 ? 0.35 : 0.2;
  return score;
}

function signature(plan: PartPlan): string {
  return PART_ROLES.map((r) => (plan[r] ? `${plan[r]!.start}-${plan[r]!.end}` : "")).join("|");
}

export function summarizePlan(plan: PartPlan): string {
  const vars = VARIATION_ROLES.filter((r) => plan[r]).length;
  const fills = FILL_ROLES.filter((r) => plan[r]).length;
  const bits = [plural(vars, "variation"), plural(fills, "fill")];
  if (plan.intro) bits.push(`intro ${plural(plan.intro.end - plan.intro.start, "bar")}`);
  if (plan.ending) bits.push(`ending ${plural(plan.ending.end - plan.ending.start, "bar")}`);
  return bits.join(" · ");
}

/** Up to `max` distinct ways to fill every RC-600 part from the song, best first. */
export function autoMapOptions(bars: readonly PlayedBar[], ppq: number, max = AUTO_MAP_MAX): AutoMapOption[] {
  if (!bars.some((b) => b.hits.length)) return [];
  const a = analyse(bars, ppq);
  const plans: PartPlan[] = [suggestParts(bars, ppq)];
  const most = Math.max(1, Math.min(VARIATION_ROLES.length, a.grooves.length));
  for (let v = most; v >= 1; v--) {
    for (const songOrder of [true, false]) {
      for (const longLoops of [false, true]) {
        for (const fillPick of [0, 1] as const) {
          for (const shortIntro of [false, true]) {
            for (const shortEnding of [false, true]) {
              plans.push(buildPlan(a, { variations: v, songOrder, longLoops, fillPick, shortIntro, shortEnding }));
            }
          }
        }
      }
    }
  }
  const seen = new Set<string>();
  const options: AutoMapOption[] = [];
  for (const [i, plan] of plans.entries()) {
    if (!VARIATION_ROLES.some((r) => plan[r])) continue;
    const key = signature(plan);
    if (seen.has(key)) continue;
    seen.add(key);
    // The section-marker suggestion follows the author's own labels, so it gets a small head start.
    const bonus = i === 0 && bars.some((b) => b.section) ? 0.4 : 0;
    options.push({ plan, score: scorePlan(a, plan) + bonus, summary: summarizePlan(plan) });
  }
  return options.sort((x, y) => y.score - x.score).slice(0, max);
}
