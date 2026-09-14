/**
 * Track FX factory library: shared Input FX presets plus Beat Scatter / Repeat / Shift / Vinyl Flick.
 */
import {
  TRACK_FX_SEQ_TYPES,
  trackFxCategory,
  trackFxDefaultSeqTags,
  trackFxDefaultTags,
  type TrackFxCategory,
} from "@rc600/catalog/track-fx";
import type { TagMap } from "@rc600/rc0/memory";
import { FACTORY_INPUT_FX_PRESETS } from "./inputFxPreset";
import type { TrackFxPreset } from "./trackFxPreset";

type FactorySpec = {
  id: string;
  name: string;
  type: number;
  category?: TrackFxCategory;
  tags?: TagMap;
  seqTags?: TagMap;
};

function mergeTags(base: TagMap, overrides?: TagMap): TagMap {
  return { ...base, ...(overrides ?? {}) };
}

function toTrackPreset(
  p: (typeof FACTORY_INPUT_FX_PRESETS)[number],
): TrackFxPreset {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    source: "factory",
    type: p.type,
    tags: { ...p.tags },
    seqTags: p.seqTags ? { ...p.seqTags } : undefined,
  };
}

/** Track-only Beat category presets (types 52–55). */
const BEAT_SPECS: FactorySpec[] = [
  { id: "scatter-p1", name: "Scatter P1 1/8", type: 52, tags: { A: "0", B: "6" } },
  { id: "scatter-p2", name: "Scatter P2 1/4", type: 52, tags: { A: "1", B: "5" } },
  { id: "scatter-p3", name: "Scatter P3 1/2", type: 52, tags: { A: "2", B: "4" } },
  { id: "scatter-p4", name: "Scatter P4 1/16", type: 52, tags: { A: "3", B: "7" } },
  { id: "scatter-short", name: "Scatter Short Glitch", type: 52, tags: { A: "0", B: "8" } },
  { id: "scatter-bar", name: "Scatter Whole Bar", type: 52, tags: { A: "2", B: "3" } },
  { id: "scatter-thru", name: "Scatter Thru Pass", type: 52, tags: { A: "1", B: "0" } },
  { id: "scatter-triplet", name: "Scatter Triplet Chop", type: 52, tags: { A: "3", B: "11" } },
  { id: "repeat-forward", name: "Repeat Forward 1/16", type: 53, tags: { A: "0", B: "7" } },
  { id: "repeat-rewind", name: "Repeat Rewind 1/32", type: 53, tags: { A: "1", B: "8" } },
  { id: "repeat-mix", name: "Repeat Mix 1/8", type: 53, tags: { A: "2", B: "6" } },
  { id: "repeat-bar", name: "Repeat Forward Bar", type: 53, tags: { A: "0", B: "3" } },
  { id: "repeat-half", name: "Repeat Rewind Half", type: 53, tags: { A: "1", B: "4" } },
  { id: "repeat-stutter", name: "Repeat Mix Stutter", type: 53, tags: { A: "2", B: "8" } },
  { id: "shift-future", name: "Shift Future 1/8", type: 54, tags: { A: "0", B: "6" } },
  { id: "shift-past", name: "Shift Past 1/8", type: 54, tags: { A: "1", B: "6" } },
  { id: "shift-nudge", name: "Shift Future Nudge", type: 54, tags: { A: "0", B: "8" } },
  { id: "shift-bar", name: "Shift Past Bar", type: 54, tags: { A: "1", B: "3" } },
  { id: "vinyl-stop", name: "Vinyl Stop", type: 55, tags: { A: "8" } },
  { id: "vinyl-slow", name: "Vinyl Slow Spin", type: 55, tags: { A: "25" } },
  { id: "vinyl-medium", name: "Vinyl Medium Flick", type: 55, tags: { A: "50" } },
  { id: "vinyl-fast", name: "Vinyl Fast Scratch", type: 55, tags: { A: "85" } },
];

export function buildFactoryTrackFxPresets(): TrackFxPreset[] {
  const out: TrackFxPreset[] = FACTORY_INPUT_FX_PRESETS.map(toTrackPreset);
  const seenIds = new Set(out.map((p) => p.id));
  const seenNames = new Set(out.map((p) => p.name.toLowerCase()));

  for (const spec of BEAT_SPECS) {
    const id = `factory-${spec.id}`;
    const name = spec.name.trim();
    if (seenIds.has(id) || seenNames.has(name.toLowerCase())) {
      throw new Error(`Duplicate factory Track FX preset: ${spec.id} / ${name}`);
    }
    seenIds.add(id);
    seenNames.add(name.toLowerCase());
    const category = spec.category ?? trackFxCategory(spec.type);
    const tags = mergeTags(trackFxDefaultTags(spec.type), spec.tags);
    const preset: TrackFxPreset = {
      id,
      name,
      category,
      source: "factory",
      type: spec.type,
      tags,
    };
    if (TRACK_FX_SEQ_TYPES.has(spec.type)) {
      preset.seqTags = mergeTags(trackFxDefaultSeqTags(), spec.seqTags);
    }
    out.push(preset);
  }
  return out;
}

export function factoryTrackFxPresetCountByCategory(): Record<TrackFxCategory | "all", number> {
  const presets = buildFactoryTrackFxPresets();
  const counts: Record<string, number> = { all: presets.length };
  for (const p of presets) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts as Record<TrackFxCategory | "all", number>;
}
