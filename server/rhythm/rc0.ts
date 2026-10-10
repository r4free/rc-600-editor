/**
 * RC-600 user rhythm file (`ROLAND/DATA/RHYTHM.RC0`), the binary the BOSS RC Rhythm Converter writes.
 *
 * Layout (little-endian): 12-byte header ("PTN_0000" + used byte count) then 50 records of 40184 bytes.
 * Each record holds one shared note list (delta ticks at 96 PPQ, ended by a note-0 marker) and
 * ten parts that are bar windows into it, in pedal order Intro, A, A Fill, B, B Fill, C, C Fill, D, D Fill, Ending.
 */
import type { PartEvents } from "./exportPack";
import { SMF_PPQ } from "./smfWriter";
import { VARIATION_ROLES, type PartRole } from "./sectionSuggest";

export const RHYTHM_RC0_PATH = "DATA/RHYTHM.RC0";
export const MAX_USER_PATTERNS = 50;
export const PATTERN_NAME_MAX = 12;
export const SEQ_PPQ = 96;
export const MAX_SEQ_ENTRIES = 10_000;

const CHUNK_ID = "PTN_0000";
const HEADER_SIZE = 12;
const NAME_SIZE = 13;
const PHRASE_OFFSET = 24;
const PHRASE_SIZE = 16;
const SEQ_OFFSET = 184;
export const RECORD_SIZE = SEQ_OFFSET + MAX_SEQ_ENTRIES * 4;

/** Pedal phrase order → converter part role. */
export const RC0_PHRASE_ROLES: readonly PartRole[] = [
  "intro",
  "varA",
  "fillA",
  "varB",
  "fillB",
  "varC",
  "fillC",
  "varD",
  "fillD",
  "ending",
];

export interface SeqEntry {
  /** Ticks (96 PPQ) since the previous entry. */
  delta: number;
  /** 0 marks the end of the sequence. */
  note: number;
  velocity: number;
}

export interface PhraseWindow {
  from: number;
  bars: number;
}

export interface UserPattern {
  name: string;
  kit: number;
  tempo: number;
  numerator: number;
  denominator: number;
  totalBars: number;
  phrases: PhraseWindow[];
  seq: SeqEntry[];
}

export function sanitizePatternName(raw: string): string {
  const ascii = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^ -~]/g, "?")
    .trim();
  return ascii.slice(0, PATTERN_NAME_MAX) || "USER";
}

/** RC-600 Beat range: 2/4–7/4 and 5/8–15/8. */
export function isSupportedMeter(numerator: number, denominator: number): boolean {
  if (denominator === 4) return numerator >= 2 && numerator <= 7;
  if (denominator === 8) return numerator >= 5 && numerator <= 15;
  return false;
}

export function barTicks(numerator: number, denominator: number): number {
  return Math.round((numerator * SEQ_PPQ * 4) / denominator);
}

export function encodeUserPattern(p: UserPattern): Uint8Array {
  if (p.phrases.length !== RC0_PHRASE_ROLES.length) throw new Error("A rhythm needs exactly 10 parts.");
  if (p.seq.length > MAX_SEQ_ENTRIES) throw new Error(`Too many notes (max ${MAX_SEQ_ENTRIES - 1}).`);
  const out = new Uint8Array(RECORD_SIZE);
  const view = new DataView(out.buffer);
  const name = sanitizePatternName(p.name);
  for (let i = 0; i < name.length; i++) out[i] = name.charCodeAt(i);
  view.setUint16(16, p.kit, true);
  view.setUint16(18, Math.round(p.tempo), true);
  out[20] = p.numerator;
  out[21] = p.denominator;
  p.phrases.forEach((ph, i) => {
    const at = PHRASE_OFFSET + i * PHRASE_SIZE;
    view.setUint16(at, ph.from, true);
    view.setUint16(at + 2, ph.bars, true);
    view.setUint16(at + 4, p.totalBars, true);
    view.setUint32(at + 8, 0, true);
    view.setUint16(at + 12, p.seq.length, true);
  });
  p.seq.forEach((e, i) => {
    if (e.delta > 0xffff) throw new Error("Gap between notes is too long for the RC-600.");
    const at = SEQ_OFFSET + i * 4;
    view.setUint16(at, e.delta, true);
    out[at + 2] = e.note;
    out[at + 3] = e.velocity;
  });
  return out;
}

export function decodeUserPattern(raw: Uint8Array): UserPattern {
  const view = new DataView(raw.buffer, raw.byteOffset, RECORD_SIZE);
  let name = "";
  for (let i = 0; i < NAME_SIZE && raw[i]; i++) name += String.fromCharCode(raw[i]!);
  const phrases: PhraseWindow[] = [];
  for (let i = 0; i < RC0_PHRASE_ROLES.length; i++) {
    const at = PHRASE_OFFSET + i * PHRASE_SIZE;
    phrases.push({ from: view.getUint16(at, true), bars: view.getUint16(at + 2, true) });
  }
  const count = Math.min(MAX_SEQ_ENTRIES, view.getUint16(PHRASE_OFFSET + 12, true));
  const seq: SeqEntry[] = [];
  for (let i = 0; i < count; i++) {
    const at = SEQ_OFFSET + i * 4;
    seq.push({ delta: view.getUint16(at, true), note: raw[at + 2]!, velocity: raw[at + 3]! });
  }
  return {
    name,
    kit: view.getUint16(16, true),
    tempo: view.getUint16(18, true),
    numerator: raw[20]!,
    denominator: raw[21]!,
    totalBars: view.getUint16(PHRASE_OFFSET + 4, true),
    phrases,
    seq,
  };
}

/**
 * Parts of a pedal rhythm. Windows that only repeat another part (an unset variation reusing
 * Variation A, or an intro / fill / ending cut from a variation) are left out.
 */
export function userPatternParts(p: UserPattern): PartEvents[] {
  if (!isSupportedMeter(p.numerator, p.denominator)) return [];
  const barLen = barTicks(p.numerator, p.denominator);
  const scale = SMF_PPQ / SEQ_PPQ;
  const hits: { tick: number; note: number; velocity: number }[] = [];
  let tick = 0;
  for (const e of p.seq) {
    tick += e.delta;
    if (e.note === 0) break;
    hits.push({ tick, note: e.note, velocity: e.velocity });
  }

  const windows = new Map<PartRole, PhraseWindow>();
  RC0_PHRASE_ROLES.forEach((role, i) => {
    const w = p.phrases[i];
    if (w && w.bars > 0 && w.from + w.bars <= Math.max(p.totalBars, 1)) windows.set(role, w);
  });
  const own: PartRole[] = [];
  const ownVariations: PhraseWindow[] = [];
  for (const role of VARIATION_ROLES) {
    const w = windows.get(role);
    if (!w || ownVariations.some((v) => v.from === w.from && v.bars === w.bars)) continue;
    ownVariations.push(w);
    own.push(role);
  }
  for (const role of RC0_PHRASE_ROLES) {
    if (role.startsWith("var")) continue;
    const w = windows.get(role);
    if (!w || ownVariations.some((v) => w.from >= v.from && w.from + w.bars <= v.from + v.bars)) continue;
    own.push(role);
  }

  return RC0_PHRASE_ROLES.filter((r) => own.includes(r)).map((role): PartEvents => {
    const w = windows.get(role)!;
    const start = w.from * barLen;
    const end = start + w.bars * barLen;
    return {
      role,
      notes: hits
        .filter((h) => h.tick >= start && h.tick < end)
        .map((h) => ({ tick: (h.tick - start) * scale, note: h.note, velocity: h.velocity, duration: SMF_PPQ / 8 })),
      lengthTicks: w.bars * barLen * scale,
      tempoBpm: p.tempo,
      numerator: p.numerator,
      denominator: p.denominator,
      bars: w.bars,
    };
  });
}

/** Used records from an existing RHYTHM.RC0 (raw bytes, so untouched patterns round-trip exactly). */
export function readRhythmRc0(bytes: Uint8Array): Uint8Array[] {
  if (bytes.length < HEADER_SIZE) throw new Error("RHYTHM.RC0 is too short.");
  const id = String.fromCharCode(...bytes.subarray(0, 8));
  if (id !== CHUNK_ID) throw new Error("RHYTHM.RC0 is not an RC-600 rhythm file.");
  const used = new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, true);
  const count = Math.min(MAX_USER_PATTERNS, Math.floor(used / RECORD_SIZE));
  const records: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const at = HEADER_SIZE + i * RECORD_SIZE;
    if (at + RECORD_SIZE > bytes.length) break;
    records.push(bytes.slice(at, at + RECORD_SIZE));
  }
  return records;
}

export function writeRhythmRc0(records: readonly Uint8Array[]): Uint8Array {
  if (records.length > MAX_USER_PATTERNS) throw new Error(`The RC-600 holds at most ${MAX_USER_PATTERNS} user rhythms.`);
  const out = new Uint8Array(HEADER_SIZE + MAX_USER_PATTERNS * RECORD_SIZE);
  for (let i = 0; i < CHUNK_ID.length; i++) out[i] = CHUNK_ID.charCodeAt(i);
  new DataView(out.buffer).setUint32(8, records.length * RECORD_SIZE, true);
  records.forEach((r, i) => out.set(r.subarray(0, RECORD_SIZE), HEADER_SIZE + i * RECORD_SIZE));
  return out;
}

export function patternNames(records: readonly Uint8Array[]): string[] {
  return records.map((r) => decodeUserPattern(r).name);
}

/** Copy of `record` with a new pattern name (everything else untouched). */
export function renameRecord(record: Uint8Array, name: string): Uint8Array {
  const out = record.slice();
  const clean = sanitizePatternName(name);
  out.fill(0, 0, 16);
  for (let i = 0; i < clean.length; i++) out[i] = clean.charCodeAt(i);
  return out;
}

/** Replace `index` (or append when null/out of range). Returns the new list and the slot used. */
export function upsertRecord(
  records: readonly Uint8Array[],
  record: Uint8Array,
  index: number | null,
): { records: Uint8Array[]; index: number } {
  const next = [...records];
  if (index != null && index >= 0 && index < next.length) {
    next[index] = record;
    return { records: next, index };
  }
  if (next.length >= MAX_USER_PATTERNS) throw new Error(`All ${MAX_USER_PATTERNS} user rhythm slots are used. Pick one to replace.`);
  next.push(record);
  return { records: next, index: next.length - 1 };
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

export interface BuildPatternInput {
  name: string;
  kit: number;
}

/** One RC-600 user rhythm from resolved parts. Parts are laid end to end in pedal order. */
export function buildUserPattern(parts: readonly PartEvents[], input: BuildPatternInput): UserPattern {
  const byRole = new Map(
    parts.map((p) => [p.role, p.role.startsWith("fill") ? lastBarOnly(p) : p] as const),
  );
  const [numerator, denominator] = patternMeter([...byRole.values()]);
  if (!isSupportedMeter(numerator, denominator)) {
    throw new Error(`${numerator}/${denominator} is not an RC-600 Beat (use 2/4–7/4 or 5/8–15/8).`);
  }
  const barLen = barTicks(numerator, denominator);
  const scale = SEQ_PPQ / SMF_PPQ;

  const windows = new Map<PartRole, PhraseWindow>();
  const hits: { tick: number; note: number; velocity: number }[] = [];
  let bar = 0;
  let tempo: number | null = null;
  for (const role of RC0_PHRASE_ROLES) {
    const ev = byRole.get(role);
    if (!ev) continue;
    const len = ev.bars * barLen;
    const base = bar * barLen;
    for (const n of ev.notes) {
      const t = Math.round(n.tick * scale);
      if (t < len) hits.push({ tick: base + t, note: n.note, velocity: n.velocity });
    }
    windows.set(role, { from: bar, bars: ev.bars });
    if (role === "varA" || tempo == null) tempo = ev.tempoBpm;
    bar += ev.bars;
  }

  const firstVar = VARIATION_ROLES.map((r) => windows.get(r)).find(Boolean);
  if (!firstVar) throw new Error("Set at least one variation before saving.");
  const lastBarOf = (w: PhraseWindow): PhraseWindow => ({ from: w.from + w.bars - 1, bars: 1 });
  const phrases = RC0_PHRASE_ROLES.map((role, i): PhraseWindow => {
    const own = windows.get(role);
    if (own) return own;
    if (role.startsWith("var")) return firstVar;
    if (role.startsWith("fill")) {
      const variation = windows.get(RC0_PHRASE_ROLES[i - 1]!) ?? firstVar;
      return lastBarOf(variation);
    }
    if (role === "intro") return { from: firstVar.from, bars: 1 };
    return lastBarOf(firstVar);
  });

  const totalBars = bar;
  const end = totalBars * barLen;
  hits.sort((a, b) => a.tick - b.tick || a.note - b.note);
  if (hits.length > MAX_SEQ_ENTRIES - 1) {
    throw new Error(`This rhythm has ${hits.length} notes; the RC-600 allows ${MAX_SEQ_ENTRIES - 1}. Shorten the parts.`);
  }
  const seq: SeqEntry[] = [];
  let prev = 0;
  for (const h of hits) {
    seq.push({ delta: h.tick - prev, note: h.note, velocity: h.velocity });
    prev = h.tick;
  }
  seq.push({ delta: end - prev, note: 0, velocity: 0 });

  return {
    name: sanitizePatternName(input.name),
    kit: input.kit,
    tempo: Math.max(40, Math.min(300, tempo ?? 120)),
    numerator,
    denominator,
    totalBars,
    phrases,
    seq,
  };
}
