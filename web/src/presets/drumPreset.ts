import {
  DEFAULT_GLOBAL_BPM,
  DEFAULT_GLOBAL_METER,
  clampBpm,
  clampHitsPerBar,
  isTimeSignature,
  type PadTimingOverride,
  type TimeSignature,
} from "../drumLoop";
import { PAD_SLOT_COUNT, clampDrumNote, defaultPadNotes } from "../drumMap";

export const DRUM_PRESET_CATALOG_VERSION = 1;
export const USER_PRESETS_STORAGE_KEY = "rc600.playDrum.userPresets";
export const NATIVE_PRESETS_URL = "/play-drum/presets.json";

export type DrumPresetSource = "native" | "user";

export interface DrumPresetPayload {
  notes: number[];
  bpm: number;
  meter: TimeSignature;
  velocity: number;
  overrides: Record<string, PadTimingOverride>;
}

export interface DrumPreset {
  id: string;
  name: string;
  source: DrumPresetSource;
  updatedAt: string;
  payload: DrumPresetPayload;
}

export interface DrumPresetCatalog {
  version: number;
  presets: DrumPreset[];
}

export function emptyDrumPresetPayload(): DrumPresetPayload {
  return {
    notes: defaultPadNotes(),
    bpm: DEFAULT_GLOBAL_BPM,
    meter: DEFAULT_GLOBAL_METER,
    velocity: 100,
    overrides: {},
  };
}

export function clampVelocity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(1, Math.min(127, Math.round(value)));
}

export function parsePadOverrides(raw: unknown): Record<string, PadTimingOverride> {
  const overrides: Record<string, PadTimingOverride> = {};
  if (!raw || typeof raw !== "object") return overrides;
  for (const [k, v] of Object.entries(raw as Record<string, PadTimingOverride>)) {
    if (!v || typeof v !== "object") continue;
    const id = Number(k);
    if (!Number.isInteger(id) || id < 0 || id >= PAD_SLOT_COUNT) continue;
    overrides[String(id)] = {
      bpm: typeof v.bpm === "number" ? clampBpm(v.bpm) : v.bpm ?? null,
      meter: v.meter && isTimeSignature(v.meter) ? v.meter : null,
      hitsPerBar: typeof v.hitsPerBar === "number" ? clampHitsPerBar(v.hitsPerBar) : 0,
    };
  }
  return overrides;
}

export function parseDrumPresetPayload(raw: unknown): DrumPresetPayload {
  const fallback = emptyDrumPresetPayload();
  if (!raw || typeof raw !== "object") return fallback;
  const parsed = raw as Partial<DrumPresetPayload>;
  const notes = Array.isArray(parsed.notes)
    ? Array.from({ length: PAD_SLOT_COUNT }, (_, i) =>
        clampDrumNote(Number(parsed.notes?.[i] ?? fallback.notes[i])),
      )
    : fallback.notes;
  return {
    notes,
    bpm: typeof parsed.bpm === "number" ? clampBpm(parsed.bpm) : fallback.bpm,
    meter: parsed.meter && isTimeSignature(parsed.meter) ? parsed.meter : fallback.meter,
    velocity: typeof parsed.velocity === "number" ? clampVelocity(parsed.velocity) : fallback.velocity,
    overrides: parsePadOverrides(parsed.overrides),
  };
}

export function overridesToPadMap(
  raw: Record<string, PadTimingOverride>,
): Record<number, PadTimingOverride> {
  const out: Record<number, PadTimingOverride> = {};
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k);
    if (Number.isInteger(id)) out[id] = v;
  }
  return out;
}

export function padMapToOverrides(
  raw: Record<number, PadTimingOverride>,
): Record<string, PadTimingOverride> {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v]));
}

export function slugifyPresetName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "rhythm";
}

export function newPresetId(source: DrumPresetSource, name: string): string {
  const slug = slugifyPresetName(name);
  if (source === "native") return slug;
  return `user-${slug}-${Date.now().toString(36)}`;
}

export function normalizePresetName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 48) || "Untitled rhythm";
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function parseDrumPreset(raw: unknown, source: DrumPresetSource): DrumPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<DrumPreset> & { payload?: unknown };
  if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;
  if (typeof parsed.name !== "string") return null;
  return {
    id: parsed.id.trim().slice(0, 80),
    name: normalizePresetName(parsed.name),
    source,
    updatedAt:
      typeof parsed.updatedAt === "string" && isIsoDate(parsed.updatedAt)
        ? parsed.updatedAt
        : new Date(0).toISOString(),
    payload: parseDrumPresetPayload(parsed.payload),
  };
}

export function parseDrumPresetCatalog(raw: unknown, source: DrumPresetSource): DrumPreset[] {
  if (!raw || typeof raw !== "object") return [];
  const parsed = raw as Partial<DrumPresetCatalog> & { presets?: unknown };
  if (!Array.isArray(parsed.presets)) return [];
  const out: DrumPreset[] = [];
  const seen = new Set<string>();
  for (const item of parsed.presets) {
    const preset = parseDrumPreset(item, source);
    if (!preset || seen.has(preset.id)) continue;
    seen.add(preset.id);
    out.push(preset);
  }
  return out;
}

export function serializeDrumPresetCatalog(presets: readonly DrumPreset[]): DrumPresetCatalog {
  return {
    version: DRUM_PRESET_CATALOG_VERSION,
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      source: p.source,
      updatedAt: p.updatedAt,
      payload: p.payload,
    })),
  };
}

export function catalogToJson(presets: readonly DrumPreset[]): string {
  return `${JSON.stringify(serializeDrumPresetCatalog(presets), null, 2)}\n`;
}

export function upsertPreset(
  list: readonly DrumPreset[],
  incoming: DrumPreset,
): DrumPreset[] {
  const next = list.filter((p) => p.id !== incoming.id);
  const sameName = next.findIndex(
    (p) => p.name.toLowerCase() === incoming.name.toLowerCase(),
  );
  if (sameName >= 0) {
    next[sameName] = { ...incoming, id: next[sameName].id };
    return next;
  }
  next.push(incoming);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function removePreset(list: readonly DrumPreset[], id: string): DrumPreset[] {
  return list.filter((p) => p.id !== id);
}

/** Vite `import.meta.env.MODE` / Node `process.env.NODE_ENV`. */
export function resolvePresetSaveTarget(
  mode: string | undefined,
): DrumPresetSource {
  return mode === "development" ? "native" : "user";
}
