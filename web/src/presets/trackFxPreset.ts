import {
  TRACK_FX_CATEGORIES,
  trackFxCategory,
  trackFxTypeLabel,
  type TrackFxCategory,
} from "@rc600/catalog/track-fx";
import type { TagMap } from "@rc600/rc0/memory";
import { buildFactoryTrackFxPresets } from "./trackFxFactoryCatalog";

export const TRACK_FX_PRESET_STORAGE_KEY = "rc600.trackFx.userPresets.v1";

export type TrackFxPresetSource = "factory" | "user";

export interface TrackFxPreset {
  id: string;
  name: string;
  category: TrackFxCategory;
  source: TrackFxPresetSource;
  /** Slot type index (tag C). */
  type: number;
  /** Tags for the type block (AA_PREAMP, AA_BEAT_REPEAT, …). */
  tags: TagMap;
  /** Optional SEQ block tags. */
  seqTags?: TagMap;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function newUserTrackFxPresetId(name: string): string {
  return `user-${slugify(name) || "effect"}-${Date.now().toString(36)}`;
}

export { buildFactoryTrackFxPresets };

export const FACTORY_TRACK_FX_PRESETS = buildFactoryTrackFxPresets();

export function parseUserTrackFxPresets(raw: unknown): TrackFxPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: TrackFxPreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    if (typeof o.type !== "number" || !Number.isFinite(o.type)) continue;
    if (o.type < 0 || o.type > 55) continue;
    if (!o.tags || typeof o.tags !== "object") continue;
    const tags: TagMap = {};
    for (const [k, v] of Object.entries(o.tags as Record<string, unknown>)) {
      if (typeof v === "string") tags[k] = v;
    }
    let seqTags: TagMap | undefined;
    if (o.seqTags && typeof o.seqTags === "object") {
      seqTags = {};
      for (const [k, v] of Object.entries(o.seqTags as Record<string, unknown>)) {
        if (typeof v === "string") seqTags[k] = v;
      }
    }
    const category =
      typeof o.category === "string" && (TRACK_FX_CATEGORIES as string[]).includes(o.category)
        ? (o.category as TrackFxCategory)
        : trackFxCategory(o.type);
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push({
      id: o.id,
      name: o.name.trim().slice(0, 40) || trackFxTypeLabel(o.type),
      category,
      source: "user",
      type: Math.trunc(o.type),
      tags,
      seqTags,
    });
  }
  return out;
}

export function loadUserTrackFxPresets(storage: Storage = localStorage): TrackFxPreset[] {
  try {
    const raw = storage.getItem(TRACK_FX_PRESET_STORAGE_KEY);
    if (!raw) return [];
    return parseUserTrackFxPresets(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveUserTrackFxPresets(
  presets: readonly TrackFxPreset[],
  storage: Storage = localStorage,
): void {
  const payload = presets
    .filter((p) => p.source === "user")
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      type: p.type,
      tags: p.tags,
      seqTags: p.seqTags,
    }));
  storage.setItem(TRACK_FX_PRESET_STORAGE_KEY, JSON.stringify(payload));
}

export function upsertUserTrackFxPreset(
  list: readonly TrackFxPreset[],
  incoming: TrackFxPreset,
): TrackFxPreset[] {
  const next = list.filter(
    (p) => p.id !== incoming.id && p.name.toLowerCase() !== incoming.name.toLowerCase(),
  );
  return [...next, { ...incoming, source: "user" }];
}

export function removeUserTrackFxPreset(list: readonly TrackFxPreset[], id: string): TrackFxPreset[] {
  return list.filter((p) => p.id !== id);
}

export function matchTrackFxPreset(
  preset: TrackFxPreset,
  query: string,
  category: "all" | TrackFxCategory,
): boolean {
  if (category !== "all" && preset.category !== category) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    preset.name.toLowerCase().includes(q) ||
    preset.category.toLowerCase().includes(q) ||
    trackFxTypeLabel(preset.type).toLowerCase().includes(q)
  );
}
