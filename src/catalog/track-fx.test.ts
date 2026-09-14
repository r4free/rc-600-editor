import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRACK_FX_BLOCK_SUFFIX,
  TRACK_FX_SEQ_TYPES,
  trackFxBlockName,
  trackFxCategory,
  trackFxDefaultTags,
  trackFxSection,
  trackFxTypeParams,
} from "./track-fx.js";
import { TRACK_FX_TYPE_OPTIONS } from "./params.js";
import { parseMemory } from "../rc0/memory.js";
import { emptyMemoryCopySelection } from "../rc0/memoryCopy.js";
import { applyOpsToModel } from "../rc0/ops.js";
import { assemble, patchTfxSection } from "../rc0/writer.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const xml = readFileSync(join(root, "fixtures", "DATA", "MEMORY001A.RC0"), "utf8");

describe("track FX type catalog", () => {
  it("extends the shared Input FX list with four Track-only types", () => {
    assert.equal(TRACK_FX_TYPE_OPTIONS.length, 56);
    assert.equal(TRACK_FX_BLOCK_SUFFIX.length, 56);
    assert.equal(trackFxBlockName(0), null);
    assert.equal(trackFxBlockName(23), "PREAMP");
    assert.equal(trackFxBlockName(52), "BEAT_SCATTER");
    assert.equal(trackFxBlockName(55), "VINYL_FLICK");
    assert.equal(trackFxSection(0, 0, 52), "AA_BEAT_SCATTER");
    assert.equal(trackFxTypeParams(52).find((p) => p.tag === "A")?.name, "Type");
    assert.equal(trackFxTypeParams(55).find((p) => p.tag === "A")?.name, "Flick");
    assert.equal(trackFxCategory(52), "Beat");
    assert.equal(trackFxCategory(23), "Amp");
    assert.ok(!TRACK_FX_SEQ_TYPES.has(52));
    assert.ok(TRACK_FX_SEQ_TYPES.has(4));
  });

  it("provides defaults from factory RC0 blocks", () => {
    const scatter = trackFxDefaultTags(52);
    assert.equal(scatter.A, "2");
    assert.equal(scatter.B, "4");
    const vinyl = trackFxDefaultTags(55);
    assert.equal(vinyl.A, "50");
  });
});

describe("track FX blocks in memory model", () => {
  it("parses Beat Scatter and shared type blocks from MEMORY001A", () => {
    const mem = parseMemory(xml, 1);
    assert.equal(mem.tfxSlots[0][0].C, "52");
    assert.ok(mem.tfxBlocks.AA_BEAT_SCATTER);
    assert.equal(mem.tfxBlocks.AA_BEAT_SCATTER.A, "2");
    assert.equal(mem.tfxBlocks.AA_BEAT_SCATTER.B, "4");
    assert.ok(mem.tfxBlocks.AA_BEAT_REPEAT);
    assert.equal(mem.tfxBlocks.AA_BEAT_REPEAT.A, "1");
    assert.ok(mem.tfxBlocks.AA_VINYL_FLICK);
    assert.equal(mem.tfxBlocks.AA_VINYL_FLICK.A, "50");
    assert.ok(mem.tfxBlocks.AA_PREAMP);
  });

  it("patches type blocks via tfx ops and applyOpsToModel", () => {
    const mem = parseMemory(xml, 1);
    const next = applyOpsToModel(mem, [
      { type: "tfx", section: "AA_BEAT_SCATTER", tags: { A: "0" } },
    ]);
    assert.equal(next.tfxBlocks.AA_BEAT_SCATTER.A, "0");
    assert.equal(mem.tfxBlocks.AA_BEAT_SCATTER.A, "2");

    const patched = patchTfxSection(xml, "AA_BEAT_SCATTER", { A: "3" });
    const again = parseMemory(patched, 1);
    assert.equal(again.tfxBlocks.AA_BEAT_SCATTER.A, "3");
  });

  it("copies Track FX type blocks between memories", () => {
    const source = patchTfxSection(xml, "AA_BEAT_SCATTER", { A: "1" });
    const target = readFileSync(join(root, "fixtures", "DATA", "MEMORY002A.RC0"), "utf8");
    const selection = emptyMemoryCopySelection();
    selection.tfxSetup = true;
    selection.tfxBanks = [true, true, true, true];
    selection.tfxSlots = [
      [true, true, true, true],
      [true, true, true, true],
      [true, true, true, true],
      [true, true, true, true],
    ];
    const { xml: out } = assemble({
      kind: "copy",
      sourceXml: source,
      targetXml: target,
      selection,
    });
    const src = parseMemory(source, 1);
    const dst = parseMemory(out, 2);
    assert.equal(src.tfxBlocks.AA_BEAT_SCATTER?.A, "1");
    assert.equal(dst.tfxBlocks.AA_BEAT_SCATTER?.A, "1");
    assert.equal(dst.tfxSlots[0][0].C, src.tfxSlots[0][0].C);
  });
});
