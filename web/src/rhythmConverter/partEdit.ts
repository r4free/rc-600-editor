/** Step-grid and bar-block edits on one rhythm part (480 PPQ notes). */
import { DRUM_INSTRUMENTS, drumLabelForNote } from "../drumMap";
import type { PartEvents } from "./exportPack";
import { drumClass } from "./sectionSuggest";
import { SMF_PPQ, type SmfNote } from "./smf";

export type EditGrid = "1/8" | "1/16" | "1/32" | "1/8T" | "1/16T";

export const EDIT_GRIDS: { value: EditGrid; label: string; ticks: number }[] = [
  { value: "1/8", label: "1/8", ticks: SMF_PPQ / 2 },
  { value: "1/16", label: "1/16", ticks: SMF_PPQ / 4 },
  { value: "1/32", label: "1/32", ticks: SMF_PPQ / 8 },
  { value: "1/8T", label: "1/8 Triplet", ticks: SMF_PPQ / 3 },
  { value: "1/16T", label: "1/16 Triplet", ticks: SMF_PPQ / 6 },
];

export function gridTicks(grid: EditGrid): number {
  return EDIT_GRIDS.find((g) => g.value === grid)?.ticks ?? SMF_PPQ / 4;
}

export const VELOCITY_LEVELS = [
  { value: 40, label: "Ghost" },
  { value: 96, label: "Normal" },
  { value: 127, label: "Accent" },
] as const;

/** Next velocity level after `velocity` (Ghost → Normal → Accent → Ghost). */
export function nextVelocity(velocity: number): number {
  let idx = 0;
  VELOCITY_LEVELS.forEach((l, i) => {
    if (Math.abs(l.value - velocity) < Math.abs(VELOCITY_LEVELS[idx]!.value - velocity)) idx = i;
  });
  return VELOCITY_LEVELS[(idx + 1) % VELOCITY_LEVELS.length]!.value;
}

const NOTE_LENGTH = SMF_PPQ / 8;

/** Top-to-bottom lane order, like a drum staff: cymbals, hi-hats, toms, snare, kick, then percussion. */
const LANE_ORDER = [49, 57, 55, 52, 51, 53, 59, 46, 42, 44, 47, 48, 50, 45, 43, 41, 37, 39, 40, 38, 36, 35];

export const DEFAULT_LANES: readonly number[] = [49, 51, 46, 42, 45, 43, 41, 38, 36];

function laneRank(note: number): number {
  const i = LANE_ORDER.indexOf(note);
  return i >= 0 ? i : LANE_ORDER.length + note;
}

/** Lanes to show: the core kit, every note the part uses, and `extra`, in staff order. */
export function partLanes(part: Pick<PartEvents, "notes"> | null, extra: readonly number[] = []): number[] {
  const set = new Set<number>([...DEFAULT_LANES, ...extra, ...(part?.notes.map((n) => n.note) ?? [])]);
  return [...set].sort((a, b) => laneRank(a) - laneRank(b));
}

export function laneLabel(note: number): string {
  return drumLabelForNote(note);
}

/** Kit instruments not shown yet, for an Add Instrument picker. */
export function addableLanes(shown: readonly number[]): { note: number; label: string }[] {
  return DRUM_INSTRUMENTS.filter((i) => !shown.includes(i.note)).map((i) => ({ note: i.note, label: i.label }));
}

export function barTicksOf(part: Pick<PartEvents, "lengthTicks" | "bars">): number {
  return Math.round(part.lengthTicks / Math.max(1, part.bars));
}

export function stepCount(part: Pick<PartEvents, "lengthTicks">, step: number): number {
  return Math.max(1, Math.ceil(part.lengthTicks / step));
}

/** Loudest velocity of `note` in each step (0 = no hit). */
export function laneCells(part: PartEvents, note: number, step: number): number[] {
  const cells = new Array<number>(stepCount(part, step)).fill(0);
  for (const n of part.notes) {
    if (n.note !== note) continue;
    const i = Math.floor(n.tick / step);
    if (i >= 0 && i < cells.length) cells[i] = Math.max(cells[i]!, n.velocity);
  }
  return cells;
}

function withNotes(part: PartEvents, notes: SmfNote[]): PartEvents {
  return { ...part, notes: [...notes].sort((a, b) => a.tick - b.tick || a.note - b.note) };
}

function inCell(n: SmfNote, note: number, index: number, step: number): boolean {
  return n.note === note && n.tick >= index * step && n.tick < (index + 1) * step;
}

/** Adds a hit at the start of the step, or replaces the hits already in it. */
export function setStep(part: PartEvents, note: number, index: number, step: number, velocity: number): PartEvents {
  const tick = index * step;
  if (tick < 0 || tick >= part.lengthTicks) return part;
  const rest = part.notes.filter((n) => !inCell(n, note, index, step));
  const v = Math.max(1, Math.min(127, Math.round(velocity)));
  return withNotes(part, [...rest, { tick, note, velocity: v, duration: NOTE_LENGTH }]);
}

export function clearStep(part: PartEvents, note: number, index: number, step: number): PartEvents {
  const rest = part.notes.filter((n) => !inCell(n, note, index, step));
  return rest.length === part.notes.length ? part : withNotes(part, rest);
}

/** Changes the velocity of the hits in a step, keeping their timing. */
export function setStepVelocity(part: PartEvents, note: number, index: number, step: number, velocity: number): PartEvents {
  const v = Math.max(1, Math.min(127, Math.round(velocity)));
  return withNotes(
    part,
    part.notes.map((n) => (inCell(n, note, index, step) ? { ...n, velocity: v } : n)),
  );
}

export function clearLane(part: PartEvents, note: number): PartEvents {
  return withNotes(part, part.notes.filter((n) => n.note !== note));
}

/** Notes of each bar, with ticks relative to the bar start. */
export function splitBars(part: PartEvents): SmfNote[][] {
  const len = barTicksOf(part);
  const out: SmfNote[][] = Array.from({ length: Math.max(1, part.bars) }, () => []);
  for (const n of part.notes) {
    const i = Math.min(out.length - 1, Math.floor(n.tick / len));
    out[i]!.push({ ...n, tick: n.tick - i * len });
  }
  return out;
}

export function joinBars(part: PartEvents, bars: readonly SmfNote[][]): PartEvents {
  const len = barTicksOf(part);
  const count = Math.max(1, bars.length);
  const notes = bars.flatMap((bar, i) => bar.map((n) => ({ ...n, tick: n.tick + i * len })));
  return withNotes({ ...part, bars: count, lengthTicks: len * count }, notes);
}

export const MAX_PART_BARS = 32;

export function duplicateBar(part: PartEvents, index: number): PartEvents {
  const bars = splitBars(part);
  if (bars.length >= MAX_PART_BARS || !bars[index]) return part;
  bars.splice(index + 1, 0, bars[index]!.map((n) => ({ ...n })));
  return joinBars(part, bars);
}

export function insertEmptyBar(part: PartEvents, at: number): PartEvents {
  const bars = splitBars(part);
  if (bars.length >= MAX_PART_BARS) return part;
  bars.splice(Math.max(0, Math.min(bars.length, at)), 0, []);
  return joinBars(part, bars);
}

export function removeBar(part: PartEvents, index: number): PartEvents {
  const bars = splitBars(part);
  if (bars.length <= 1 || !bars[index]) return part;
  bars.splice(index, 1);
  return joinBars(part, bars);
}

export function moveBar(part: PartEvents, from: number, to: number): PartEvents {
  const bars = splitBars(part);
  if (!bars[from] || to < 0 || to >= bars.length || from === to) return part;
  const [moved] = bars.splice(from, 1);
  bars.splice(to, 0, moved!);
  return joinBars(part, bars);
}

/** Replaces bar `index` with `notes` (relative ticks); `null` clears it. */
export function replaceBar(part: PartEvents, index: number, notes: readonly SmfNote[] | null): PartEvents {
  const bars = splitBars(part);
  if (!bars[index]) return part;
  const len = barTicksOf(part);
  bars[index] = (notes ?? []).filter((n) => n.tick >= 0 && n.tick < len).map((n) => ({ ...n }));
  return joinBars(part, bars);
}

/** Empty part of `bars` bars, for writing a rhythm from scratch. */
export function emptyPart(
  role: PartEvents["role"],
  input: { bars: number; numerator: number; denominator: number; tempoBpm: number },
): PartEvents {
  const len = Math.round((SMF_PPQ * 4 * input.numerator) / input.denominator);
  const bars = Math.max(1, Math.min(MAX_PART_BARS, Math.round(input.bars)));
  return {
    role,
    notes: [],
    lengthTicks: len * bars,
    tempoBpm: input.tempoBpm,
    numerator: input.numerator,
    denominator: input.denominator,
    bars,
  };
}

export type ThumbRow = "cymbal" | "hat" | "tom" | "snare" | "kick";
export const THUMB_ROWS: readonly ThumbRow[] = ["cymbal", "hat", "tom", "snare", "kick"];

/** Tiny bar picture: which drum family plays in each of `slots` steps. */
export function barThumbnail(
  hits: readonly { tick: number; note: number }[],
  lengthTicks: number,
  slots = 16,
): Record<ThumbRow, boolean[]> {
  const rows = Object.fromEntries(THUMB_ROWS.map((r) => [r, new Array<boolean>(slots).fill(false)])) as Record<
    ThumbRow,
    boolean[]
  >;
  const len = Math.max(1, lengthTicks);
  for (const h of hits) {
    const cls = drumClass(h.note);
    const row: ThumbRow = cls === "perc" ? "tom" : cls;
    const i = Math.floor((h.tick / len) * slots);
    if (i >= 0 && i < slots) rows[row][i] = true;
  }
  return rows;
}
