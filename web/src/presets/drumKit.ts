import {
  clampDrumNote,
  clampPadCount,
  defaultPadNotes,
  notesForPadCount,
} from "../drumMap";

export const DRUM_KIT_CATALOG_VERSION = 1;
export const USER_KITS_STORAGE_KEY = "rc600.playDrum.userKits";
export const NATIVE_KITS_URL = "/play-drum/kits.json";
export const DEFAULT_KIT_ID = "studio-16";

export type DrumKitSource = "native" | "user";

export interface DrumKit {
  id: string;
  name: string;
  source: DrumKitSource;
  updatedAt: string;
  padCount: number;
  notes: number[];
}

export interface DrumKitCatalog {
  version: number;
  kits: DrumKit[];
}

interface KitBlueprint {
  id: string;
  name: string;
  notes: readonly number[];
}

/** Factory pad layouts. Each kit exposes a different instrument set / pad count. */
export const FACTORY_KIT_BLUEPRINTS: readonly KitBlueprint[] = [
  { id: "studio-16", name: "Studio", notes: defaultPadNotes() },
  { id: "rock-12", name: "Rock", notes: [36, 38, 39, 37, 42, 46, 44, 41, 43, 45, 49, 51] },
  { id: "metal-12", name: "Metal", notes: [36, 38, 42, 46, 41, 43, 45, 47, 49, 57, 52, 51] },
  { id: "jazz-9", name: "Jazz", notes: [36, 38, 37, 42, 46, 51, 41, 43, 49] },
  { id: "brush-8", name: "Brush", notes: [36, 38, 37, 42, 46, 51, 41, 49] },
  { id: "cajon-8", name: "Cajon", notes: [36, 38, 37, 42, 44, 39, 54, 56] },
  { id: "latin-12", name: "Latin", notes: [36, 38, 37, 42, 60, 61, 63, 64, 65, 66, 75, 56] },
  { id: "funk-12", name: "Funk", notes: [36, 38, 39, 37, 42, 46, 44, 41, 43, 49, 51, 56] },
  { id: "hiphop-8", name: "Hip-Hop", notes: [36, 38, 39, 42, 46, 37, 41, 49] },
  { id: "808-8", name: "808", notes: [36, 38, 39, 42, 46, 41, 56, 49] },
  { id: "dnb-8", name: "Drum & Bass", notes: [36, 38, 42, 46, 37, 41, 49, 51] },
  { id: "techno-8", name: "Techno", notes: [36, 39, 42, 46, 37, 41, 56, 49] },
  { id: "practice-4", name: "Practice", notes: [36, 38, 42, 46] },
];

export function emptyDrumKit(): DrumKit {
  const notes = defaultPadNotes();
  return {
    id: DEFAULT_KIT_ID,
    name: "Studio",
    source: "native",
    updatedAt: new Date(0).toISOString(),
    padCount: notes.length,
    notes,
  };
}

export function normalizeKitName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 48) || "Untitled kit";
}

export function slugifyKitName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "kit";
}

export function newKitId(source: DrumKitSource, name: string): string {
  const slug = slugifyKitName(name);
  if (source === "native") return slug;
  return `user-${slug}-${Date.now().toString(36)}`;
}

export function parseKitNotes(raw: unknown, padCount?: number): number[] {
  const fallback = defaultPadNotes();
  if (!Array.isArray(raw) || raw.length === 0) {
    return notesForPadCount(fallback, padCount ?? fallback.length);
  }
  const count = clampPadCount(padCount ?? raw.length);
  return Array.from({ length: count }, (_, i) =>
    clampDrumNote(Number(raw[i] ?? fallback[i] ?? 36)),
  );
}

export function kitsEqualLayout(a: DrumKit, notes: readonly number[], padCount: number): boolean {
  if (a.padCount !== padCount) return false;
  if (a.notes.length !== notes.length) return false;
  return a.notes.every((n, i) => n === notes[i]);
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function parseDrumKit(raw: unknown, source: DrumKitSource): DrumKit | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<DrumKit>;
  if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;
  if (typeof parsed.name !== "string") return null;
  const notes = parseKitNotes(parsed.notes, parsed.padCount);
  return {
    id: parsed.id.trim().slice(0, 80),
    name: normalizeKitName(parsed.name),
    source,
    updatedAt:
      typeof parsed.updatedAt === "string" && isIsoDate(parsed.updatedAt)
        ? parsed.updatedAt
        : new Date(0).toISOString(),
    padCount: notes.length,
    notes,
  };
}

export function parseDrumKitCatalog(raw: unknown, source: DrumKitSource): DrumKit[] {
  if (!raw || typeof raw !== "object") return [];
  const parsed = raw as Partial<DrumKitCatalog> & { kits?: unknown };
  if (!Array.isArray(parsed.kits)) return [];
  const out: DrumKit[] = [];
  const seen = new Set<string>();
  for (const item of parsed.kits) {
    const kit = parseDrumKit(item, source);
    if (!kit || seen.has(kit.id)) continue;
    seen.add(kit.id);
    out.push(kit);
  }
  return out;
}

export function serializeDrumKitCatalog(kits: readonly DrumKit[]): DrumKitCatalog {
  return {
    version: DRUM_KIT_CATALOG_VERSION,
    kits: kits.map((k) => ({
      id: k.id,
      name: k.name,
      source: k.source,
      updatedAt: k.updatedAt,
      padCount: clampPadCount(k.padCount),
      notes: parseKitNotes(k.notes, k.padCount),
    })),
  };
}

export function kitsToJson(kits: readonly DrumKit[]): string {
  return `${JSON.stringify(serializeDrumKitCatalog(kits), null, 2)}\n`;
}

export function upsertKit(list: readonly DrumKit[], incoming: DrumKit): DrumKit[] {
  const next = list.filter((k) => k.id !== incoming.id);
  const sameName = next.findIndex((k) => k.name.toLowerCase() === incoming.name.toLowerCase());
  if (sameName >= 0) {
    next[sameName] = { ...incoming, id: next[sameName].id };
    return next;
  }
  next.push(incoming);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function removeKit(list: readonly DrumKit[], id: string): DrumKit[] {
  return list.filter((k) => k.id !== id);
}

export function findKit(kits: readonly DrumKit[], id: string | undefined): DrumKit | undefined {
  if (!id) return undefined;
  return kits.find((k) => k.id === id);
}

export function factoryDrumKits(updatedAt = "2026-09-13T18:00:00.000Z"): DrumKit[] {
  return FACTORY_KIT_BLUEPRINTS.map((bp) => {
    const notes = parseKitNotes(bp.notes, bp.notes.length);
    return {
      id: bp.id,
      name: bp.name,
      source: "native" as const,
      updatedAt,
      padCount: notes.length,
      notes,
    };
  });
}

export function defaultFactoryKit(): DrumKit {
  return factoryDrumKits().find((k) => k.id === DEFAULT_KIT_ID) ?? emptyDrumKit();
}

export function kitFromNotes(
  notes: readonly number[],
  padCount = notes.length,
  id = DEFAULT_KIT_ID,
): DrumKit {
  const parsed = parseKitNotes(notes, padCount);
  return {
    ...emptyDrumKit(),
    id,
    notes: parsed,
    padCount: parsed.length,
  };
}
