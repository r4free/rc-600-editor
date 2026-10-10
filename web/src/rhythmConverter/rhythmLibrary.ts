/** Ready-made rhythms: a full set of parts (Intro … Ending) with a name, kit and tags. */
import type { PartEvents } from "./exportPack";
import {
  eventsFromLibraryPart,
  libraryPartFromEvents,
  newPartId,
  normalizePartName,
  normalizeTags,
  parseLibraryPart,
  partKindForRole,
  type LibraryNote,
  type LibraryPart,
  type LibrarySource,
} from "./partLibrary";
import type { SlotRecord } from "./rhythmRc0";
import { PART_LABELS, PART_ROLES, type PartRole } from "./sectionSuggest";

export const RHYTHM_LIBRARY_VERSION = 1;
export const NATIVE_RHYTHMS_URL = "/rhythm-converter/rhythms.json";
export const RHYTHMS_API_URL = "/api/rhythm-library";
export const USER_RHYTHMS_STORAGE_KEY = "rc600.rhythmConverter.rhythms";

export interface RhythmPartData {
  tempoBpm: number;
  numerator: number;
  denominator: number;
  bars: number;
  lengthTicks: number;
  notes: LibraryNote[];
}

export interface LibraryRhythm {
  id: string;
  name: string;
  /** Kit index stored with the rhythm on the pedal. */
  kit: number;
  tags: string[];
  source: LibrarySource;
  updatedAt: string;
  parts: Partial<Record<PartRole, RhythmPartData>>;
}

function parsePartData(raw: unknown, role: PartRole): RhythmPartData | null {
  if (!raw || typeof raw !== "object") return null;
  const p = parseLibraryPart({ ...(raw as object), kind: partKindForRole(role), name: role, id: role }, "user");
  if (!p) return null;
  const { tempoBpm, numerator, denominator, bars, lengthTicks, notes } = p;
  return { tempoBpm, numerator, denominator, bars, lengthTicks, notes };
}

export function parseLibraryRhythm(raw: unknown, source: LibrarySource): LibraryRhythm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const parts: LibraryRhythm["parts"] = {};
  const rawParts = (r.parts && typeof r.parts === "object" ? r.parts : {}) as Record<string, unknown>;
  for (const role of PART_ROLES) {
    const data = parsePartData(rawParts[role], role);
    if (data) parts[role] = data;
  }
  if (!Object.keys(parts).length) return null;
  const name = normalizePartName(String(r.name ?? ""));
  const kit = Math.round(Number(r.kit));
  return {
    id: String(r.id ?? "").trim() || newPartId(source, name),
    name,
    kit: Number.isFinite(kit) && kit >= 0 && kit < 64 ? kit : 0,
    tags: normalizeTags(Array.isArray(r.tags) ? r.tags.map(String) : []),
    source,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(0).toISOString(),
    parts,
  };
}

export function parseRhythmLibrary(raw: unknown, source: LibrarySource): LibraryRhythm[] {
  const list = Array.isArray(raw) ? raw : (raw as { rhythms?: unknown } | null)?.rhythms;
  if (!Array.isArray(list)) return [];
  return list.map((r) => parseLibraryRhythm(r, source)).filter((r): r is LibraryRhythm => r !== null);
}

export function rhythmLibraryToJson(rhythms: readonly LibraryRhythm[]): string {
  return `${JSON.stringify(
    { version: RHYTHM_LIBRARY_VERSION, rhythms: rhythms.map(({ source: _source, ...rest }) => rest) },
    null,
    2,
  )}\n`;
}

/** Replaces by id, or by same name (keeping that id); otherwise appends. Sorted by name. */
export function upsertRhythm(list: readonly LibraryRhythm[], incoming: LibraryRhythm): LibraryRhythm[] {
  const next = list.filter((r) => r.id !== incoming.id);
  const same = next.findIndex((r) => r.name.toLowerCase() === incoming.name.toLowerCase());
  if (same >= 0) next[same] = { ...incoming, id: next[same]!.id };
  else next.push(incoming);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function removeRhythm(list: readonly LibraryRhythm[], id: string): LibraryRhythm[] {
  return list.filter((r) => r.id !== id);
}

export function rhythmFromParts(
  parts: readonly PartEvents[],
  input: { name: string; kit: number; tags: readonly string[]; source: LibrarySource; id?: string },
): LibraryRhythm {
  const name = normalizePartName(input.name);
  const out: LibraryRhythm["parts"] = {};
  for (const p of parts) {
    out[p.role] = {
      tempoBpm: p.tempoBpm,
      numerator: p.numerator,
      denominator: p.denominator,
      bars: p.bars,
      lengthTicks: p.lengthTicks,
      notes: p.notes.map(({ tick, note, velocity }) => ({ tick, note, velocity })),
    };
  }
  return {
    id: input.id?.trim() || newPartId(input.source, name),
    name,
    kit: input.kit,
    tags: normalizeTags(input.tags),
    source: input.source,
    updatedAt: new Date().toISOString(),
    parts: out,
  };
}

/** The rhythm's parts as converter part events, in pedal role order. */
export function partsFromRhythm(rhythm: LibraryRhythm): PartEvents[] {
  return PART_ROLES.flatMap((role) => {
    const data = rhythm.parts[role];
    if (!data) return [];
    return [
      eventsFromLibraryPart(
        { ...data, id: rhythm.id, name: rhythm.name, kind: partKindForRole(role), tags: [], source: rhythm.source, updatedAt: "" },
        role,
      ),
    ];
  });
}

export const PEDAL_IMPORT_TAG = "From RC-600";

export interface PedalRhythm {
  /** 0-based user rhythm slot on the pedal. */
  slot: number;
  rhythm: LibraryRhythm;
}

/** User rhythms in decoded RHYTHM.RC0 slots, ready for the personal library (names made unique). */
export function rhythmsFromSlots(slots: readonly SlotRecord[]): PedalRhythm[] {
  const seen = new Set<string>();
  const out: PedalRhythm[] = [];
  slots.forEach((record, slot) => {
    if (!record.parts.some((p) => p.notes.length)) return;
    let name = record.name.trim() || `User ${slot + 1}`;
    if (seen.has(name.toLowerCase())) name = `${name} (${slot + 1})`;
    seen.add(name.toLowerCase());
    out.push({
      slot,
      rhythm: rhythmFromParts(record.parts, { name, kit: record.kit, tags: [PEDAL_IMPORT_TAG], source: "user" }),
    });
  });
  return out;
}

/** Each part of `rhythm` as a Part Library entry named "<rhythm> <part>". */
export function libraryPartsFromRhythm(rhythm: LibraryRhythm, source: LibrarySource): LibraryPart[] {
  return partsFromRhythm(rhythm)
    .filter((p) => p.notes.length)
    .map((p) =>
      libraryPartFromEvents(p, {
        name: `${rhythm.name} ${PART_LABELS[p.role]}`,
        tags: rhythm.tags,
        source,
        kind: partKindForRole(p.role),
      }),
    );
}

export function rhythmSummary(rhythm: LibraryRhythm): { parts: number; tempoBpm: number; meter: string } {
  const list = PART_ROLES.map((r) => rhythm.parts[r]).filter((p): p is RhythmPartData => Boolean(p));
  const first = rhythm.parts.varA ?? list[0]!;
  return { parts: list.length, tempoBpm: first.tempoBpm, meter: `${first.numerator}/${first.denominator}` };
}
