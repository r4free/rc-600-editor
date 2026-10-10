/** Reusable rhythm parts (a converted Variation, Fill, Intro or Ending) shared across rhythms. */
import type { PartEvents } from "./exportPack";
import { PART_ROLES, type PartRole } from "./sectionSuggest";
import { SMF_PPQ } from "./smf";

export const PART_LIBRARY_VERSION = 1;
export const NATIVE_PARTS_URL = "/rhythm-converter/parts.json";
export const USER_PARTS_STORAGE_KEY = "rc600.rhythmConverter.library";
export const PART_NAME_MAX = 40;
const MAX_NOTES = 4000;

export type LibrarySource = "native" | "user";
export type PartKind = "intro" | "variation" | "fill" | "ending";

export const PART_KIND_LABELS: Record<PartKind, string> = {
  intro: "Intro",
  variation: "Variation",
  fill: "Fill",
  ending: "Ending",
};

export interface LibraryNote {
  /** Ticks at `SMF_PPQ` (480) from the start of the part. */
  tick: number;
  note: number;
  velocity: number;
}

/** Ready-made tags offered when saving; users can add their own. */
export const STYLE_TAGS = [
  "Rock",
  "Pop",
  "Pop Rock",
  "Hard Rock",
  "Metal",
  "Punk",
  "Indie",
  "Blues",
  "Jazz",
  "Funk",
  "Soul",
  "R&B",
  "Hip Hop",
  "Reggae",
  "Ska",
  "Country",
  "Folk",
  "Gospel",
  "Disco",
  "Electronic",
  "Latin",
  "Salsa",
  "Cumbia",
  "Bossa Nova",
  "Samba",
  "Pagode",
  "MPB",
  "Forró",
  "Baião",
  "Xote",
  "Xaxado",
  "Sertanejo",
  "Axé",
  "Frevo",
  "Maracatu",
  "Ijexá",
  "Arrocha",
  "Brega",
  "Funk Carioca",
  "Worship",
] as const;

export const FEEL_TAGS = [
  "Straight",
  "Shuffle",
  "Swing",
  "Half Time",
  "Double Time",
  "Ballad",
  "Slow",
  "Medium",
  "Fast",
  "Groove",
  "Build Up",
  "Breakdown",
  "Brushes",
  "Percussion",
] as const;

export const TAG_MAX = 24;
export const TAGS_PER_PART_MAX = 12;

export function normalizeTag(tag: string): string {
  return tag.replace(/\s+/g, " ").trim().slice(0, TAG_MAX);
}

/** Trimmed, de-duplicated (case-insensitive) tags, in the given order. */
export function normalizeTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const tag = normalizeTag(String(t));
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= TAGS_PER_PART_MAX) break;
  }
  return out;
}

export interface LibraryPart {
  id: string;
  name: string;
  /** Category: which rhythm slots the part can fill. */
  kind: PartKind;
  /** Style and feel tags such as Rock, Forró or Half Time. */
  tags: string[];
  source: LibrarySource;
  updatedAt: string;
  tempoBpm: number;
  numerator: number;
  denominator: number;
  bars: number;
  lengthTicks: number;
  notes: LibraryNote[];
}

export interface PartLibraryCatalog {
  version: number;
  parts: Omit<LibraryPart, "source">[];
}

export function partKindForRole(role: PartRole): PartKind {
  if (role === "intro") return "intro";
  if (role === "ending") return "ending";
  return role.startsWith("fill") ? "fill" : "variation";
}

/** Roles a part of `kind` can fill. */
export function rolesForKind(kind: PartKind): PartRole[] {
  return PART_ROLES.filter((r) => partKindForRole(r) === kind);
}

export function normalizePartName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, PART_NAME_MAX) || "Untitled part";
}

function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "part"
  );
}

export function newPartId(source: LibrarySource, name: string): string {
  const prefix = source === "native" ? "" : "user-";
  return `${prefix}${slug(name)}-${Date.now().toString(36)}`;
}

const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function parseLibraryPart(raw: unknown, source: LibrarySource): LibraryPart | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (kind !== "intro" && kind !== "variation" && kind !== "fill" && kind !== "ending") return null;
  const name = normalizePartName(String(r.name ?? ""));
  const rawLength = Math.round(Number(r.lengthTicks));
  if (!(rawLength >= 1) || !Array.isArray(r.notes)) return null;
  const lengthTicks = Math.min(SMF_PPQ * 4 * 64, rawLength);
  const notes: LibraryNote[] = [];
  for (const n of r.notes.slice(0, MAX_NOTES)) {
    if (!n || typeof n !== "object") continue;
    const o = n as Record<string, unknown>;
    const tick = Math.round(Number(o.tick));
    const note = Math.round(Number(o.note));
    if (!(tick >= 0 && tick < lengthTicks) || !(note >= 0 && note <= 127)) continue;
    notes.push({ tick, note, velocity: int(o.velocity, 1, 127, 100) });
  }
  notes.sort((a, b) => a.tick - b.tick || a.note - b.note);
  return {
    id: String(r.id ?? "").trim() || newPartId(source, name),
    name,
    kind,
    tags: normalizeTags(Array.isArray(r.tags) ? r.tags.map(String) : r.style ? [String(r.style)] : []),
    source,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(0).toISOString(),
    tempoBpm: int(r.tempoBpm, 20, 300, 120),
    numerator: int(r.numerator, 1, 32, 4),
    denominator: [2, 4, 8, 16].includes(Number(r.denominator)) ? Number(r.denominator) : 4,
    bars: int(r.bars, 1, 64, 1),
    lengthTicks,
    notes,
  };
}

export function parsePartLibrary(raw: unknown, source: LibrarySource): LibraryPart[] {
  const list = Array.isArray(raw) ? raw : (raw as { parts?: unknown } | null)?.parts;
  if (!Array.isArray(list)) return [];
  return list.map((p) => parseLibraryPart(p, source)).filter((p): p is LibraryPart => p !== null);
}

export function partLibraryToJson(parts: readonly LibraryPart[]): string {
  const catalog: PartLibraryCatalog = {
    version: PART_LIBRARY_VERSION,
    parts: parts.map(({ source: _source, ...rest }) => rest),
  };
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

const KIND_ORDER: PartKind[] = ["intro", "variation", "fill", "ending"];

function sortParts(parts: LibraryPart[]): LibraryPart[] {
  return parts.sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name),
  );
}

/** Replaces by id, or by same name + kind (keeping that id); otherwise appends. */
export function upsertPart(list: readonly LibraryPart[], incoming: LibraryPart): LibraryPart[] {
  const next = list.filter((p) => p.id !== incoming.id);
  const same = next.findIndex(
    (p) => p.kind === incoming.kind && p.name.toLowerCase() === incoming.name.toLowerCase(),
  );
  if (same >= 0) next[same] = { ...incoming, id: next[same]!.id };
  else next.push(incoming);
  return sortParts(next);
}

export function removePart(list: readonly LibraryPart[], id: string): LibraryPart[] {
  return list.filter((p) => p.id !== id);
}

export function libraryPartFromEvents(
  events: PartEvents,
  input: { name: string; tags: readonly string[]; source: LibrarySource; id?: string; kind?: PartKind },
): LibraryPart {
  const name = normalizePartName(input.name);
  return {
    id: input.id?.trim() || newPartId(input.source, name),
    name,
    kind: input.kind ?? partKindForRole(events.role),
    tags: normalizeTags(input.tags),
    source: input.source,
    updatedAt: new Date().toISOString(),
    tempoBpm: events.tempoBpm,
    numerator: events.numerator,
    denominator: events.denominator,
    bars: events.bars,
    lengthTicks: events.lengthTicks,
    notes: events.notes.map(({ tick, note, velocity }) => ({ tick, note, velocity })),
  };
}

const LIBRARY_NOTE_LENGTH = SMF_PPQ / 8;

/** Library part placed in `role` of a rhythm. */
export function eventsFromLibraryPart(part: LibraryPart, role: PartRole): PartEvents {
  return {
    role,
    notes: part.notes.map((n) => ({ ...n, duration: LIBRARY_NOTE_LENGTH })),
    lengthTicks: part.lengthTicks,
    tempoBpm: part.tempoBpm,
    numerator: part.numerator,
    denominator: part.denominator,
    bars: part.bars,
  };
}

/** Every tag used in `parts`, once, sorted. */
export function libraryTags(parts: readonly Pick<LibraryPart, "tags">[]): string[] {
  const byKey = new Map<string, string>();
  for (const p of parts) for (const t of p.tags) if (!byKey.has(t.toLowerCase())) byKey.set(t.toLowerCase(), t);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** True when `part` has every tag in `wanted` (case-insensitive). */
export function hasAllTags(part: Pick<LibraryPart, "tags">, wanted: readonly string[]): boolean {
  const own = new Set(part.tags.map((t) => t.toLowerCase()));
  return wanted.every((t) => own.has(t.toLowerCase()));
}

/** First role a part of `kind` fills (used when building events for a new library part). */
export function defaultRoleForKind(kind: PartKind): PartRole {
  return rolesForKind(kind)[0]!;
}
