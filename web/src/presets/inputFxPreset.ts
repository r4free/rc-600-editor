import {
  INPUT_FX_CATEGORIES,
  inputFxCategory,
  inputFxTypeLabel,
  type InputFxCategory,
} from "@rc600/catalog/input-fx";
import type { TagMap } from "@rc600/rc0/memory";
import { buildFactoryInputFxPresets } from "./inputFxFactoryCatalog";

export const INPUT_FX_PRESET_STORAGE_KEY = "rc600.inputFx.userPresets.v1";

export type InputFxPresetSource = "factory" | "user";

export interface InputFxPreset {
  id: string;
  name: string;
  category: InputFxCategory;
  source: InputFxPresetSource;
  /** Slot type index (tag C). */
  type: number;
  /** Tags for the type block (AA_PREAMP, …). */
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

export function newUserPresetId(name: string): string {
  return `user-${slugify(name) || "effect"}-${Date.now().toString(36)}`;
}

export { buildFactoryInputFxPresets };

/** Large curated factory library (many named presets per category). */
export const FACTORY_INPUT_FX_PRESETS = buildFactoryInputFxPresets();

export function parseUserInputFxPresets(raw: unknown): InputFxPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: InputFxPreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    if (typeof o.type !== "number" || !Number.isFinite(o.type)) continue;
    if (o.type < 0 || o.type > 51) continue;
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
      typeof o.category === "string" && (INPUT_FX_CATEGORIES as string[]).includes(o.category)
        ? (o.category as InputFxCategory)
        : inputFxCategory(o.type);
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push({
      id: o.id,
      name: o.name.trim().slice(0, 40) || inputFxTypeLabel(o.type),
      category,
      source: "user",
      type: Math.trunc(o.type),
      tags,
      seqTags,
    });
  }
  return out;
}

export function loadUserInputFxPresets(storage: Storage = localStorage): InputFxPreset[] {
  try {
    const raw = storage.getItem(INPUT_FX_PRESET_STORAGE_KEY);
    if (!raw) return [];
    return parseUserInputFxPresets(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveUserInputFxPresets(
  presets: readonly InputFxPreset[],
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
  storage.setItem(INPUT_FX_PRESET_STORAGE_KEY, JSON.stringify(payload));
}

export function upsertUserInputFxPreset(
  list: readonly InputFxPreset[],
  incoming: InputFxPreset,
): InputFxPreset[] {
  const next = list.filter((p) => p.id !== incoming.id && p.name.toLowerCase() !== incoming.name.toLowerCase());
  return [...next, { ...incoming, source: "user" }];
}

export function removeUserInputFxPreset(list: readonly InputFxPreset[], id: string): InputFxPreset[] {
  return list.filter((p) => p.id !== id);
}

export function matchInputFxPreset(
  preset: InputFxPreset,
  query: string,
  category: "all" | InputFxCategory,
): boolean {
  if (category !== "all" && preset.category !== category) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    preset.name.toLowerCase().includes(q) ||
    preset.category.toLowerCase().includes(q) ||
    inputFxTypeLabel(preset.type).toLowerCase().includes(q)
  );
}
