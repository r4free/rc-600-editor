import { inputFxCategory, inputFxSection, inputFxSeqSection } from "@rc600/catalog/input-fx";
import { FX_BANKS } from "@rc600/catalog/params";
import { parseMemory, type TagMap } from "@rc600/rc0/memory";
import { newUserPresetId, upsertUserInputFxPreset, type InputFxPreset } from "./inputFxPreset";

export interface CaptureMemory {
  slot: number;
  /** XML of the active side (A or B) of the memory. */
  xml: string;
}

export interface CaptureResult {
  presets: InputFxPreset[];
  memories: number;
  added: number;
  duplicates: number;
}

const NAME_MAX = 40;

function sortedTags(tags: TagMap | undefined): string {
  if (!tags) return "";
  return JSON.stringify(
    Object.keys(tags)
      .sort()
      .map((k) => [k, tags[k]]),
  );
}

export function inputFxPresetKey(p: Pick<InputFxPreset, "type" | "tags" | "seqTags">): string {
  return `${p.type}|${sortedTags(p.tags)}|${sortedTags(p.seqTags)}`;
}

export function capturedPresetName(slot: number, memoryName: string, bank: number, fxSlot: number): string {
  const prefix = String(slot).padStart(3, "0");
  const suffix = `${FX_BANKS[bank]}${FX_BANKS[fxSlot]}`;
  const room = NAME_MAX - prefix.length - suffix.length - 2;
  const name = memoryName.trim().slice(0, Math.max(0, room)).trim();
  return name ? `${prefix} ${name} ${suffix}` : `${prefix} ${suffix}`;
}

/**
 * Reads every input FX slot (4 banks × 4 FX) of each memory and adds it to the
 * user library. THRU slots are skipped; an effect whose type and settings
 * already exist in the library (or earlier in this capture) is not added twice.
 */
export function captureInputFxPresets(
  memories: readonly CaptureMemory[],
  existing: readonly InputFxPreset[],
): CaptureResult {
  const seen = new Set(existing.map(inputFxPresetKey));
  let presets = [...existing];
  let added = 0;
  let duplicates = 0;

  for (const mem of memories) {
    const model = parseMemory(mem.xml, mem.slot);
    for (let bank = 0; bank < FX_BANKS.length; bank++) {
      for (let fxSlot = 0; fxSlot < FX_BANKS.length; fxSlot++) {
        const type = parseInt(model.ifxSlots[bank]?.[fxSlot]?.C ?? "", 10);
        if (!Number.isFinite(type) || type <= 0 || type > 51) continue;
        const section = inputFxSection(bank, fxSlot, type);
        const seqSection = inputFxSeqSection(bank, fxSlot, type);
        const tags = section ? { ...(model.ifxBlocks[section] ?? {}) } : {};
        const seqTags =
          seqSection && model.ifxBlocks[seqSection] ? { ...model.ifxBlocks[seqSection] } : undefined;
        const key = inputFxPresetKey({ type, tags, seqTags });
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);
        const name = capturedPresetName(mem.slot, model.name, bank, fxSlot);
        presets = upsertUserInputFxPreset(presets, {
          id: newUserPresetId(name),
          name,
          category: inputFxCategory(type),
          source: "user",
          type,
          tags,
          seqTags,
        });
        added++;
      }
    }
  }

  return { presets, memories: memories.length, added, duplicates };
}
