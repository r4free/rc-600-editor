import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INPUT_FX_BLOCK_SUFFIX,
  INPUT_FX_SEQ_TYPES,
  inputFxBlockName,
  inputFxDefaultTags,
  inputFxSection,
  inputFxTypeParams,
} from "./input-fx.js";
import { INPUT_FX_TYPE_OPTIONS } from "./params.js";
import { parseMemory } from "../rc0/memory.js";
import { applyOpsToModel } from "../rc0/ops.js";
import { assemble, patchIfxSection } from "../rc0/writer.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const xml = readFileSync(join(root, "fixtures", "DATA", "MEMORY001A.RC0"), "utf8");

describe("input FX type catalog", () => {
  it("maps 52 types to RC0 block suffixes", () => {
    assert.equal(INPUT_FX_TYPE_OPTIONS.length, 52);
    assert.equal(INPUT_FX_BLOCK_SUFFIX.length, 52);
    assert.equal(inputFxBlockName(0), null);
    assert.equal(inputFxBlockName(23), "PREAMP");
    assert.equal(inputFxBlockName(7), "LOFI");
    assert.equal(inputFxSection(0, 0, 23), "AA_PREAMP");
    assert.equal(inputFxTypeParams(23).find((p) => p.tag === "A")?.name, "Amp Type");
    assert.ok(inputFxTypeParams(7).some((p) => p.tag === "D"));
    assert.ok(!inputFxTypeParams(7).some((p) => p.tag === "C"));
    assert.ok(INPUT_FX_SEQ_TYPES.has(4));
    assert.ok(!INPUT_FX_SEQ_TYPES.has(23));
  });

  it("provides defaults for factory presets", () => {
    const tags = inputFxDefaultTags(23);
    assert.equal(tags.A, "3");
    assert.equal(tags.L, "50");
  });
});

describe("input FX blocks in memory model", () => {
  it("parses AA_PREAMP and Step Slicer extra tags from MEMORY001A", () => {
    const mem = parseMemory(xml, 1);
    assert.ok(mem.ifxBlocks.AA_PREAMP);
    assert.equal(mem.ifxBlocks.AA_PREAMP.A, "3");
    assert.equal(mem.ifxBlocks.AA_PREAMP.L, "50");
    assert.ok(mem.ifxBlocks.AA_LOFI);
    assert.equal(mem.ifxBlocks.AA_LOFI.A, "24");
    assert.equal(mem.ifxBlocks.AA_LOFI.D, "50");
    assert.ok(mem.ifxBlocks.AA_STEP_SLICER);
    assert.equal(mem.ifxBlocks.AA_STEP_SLICER["#"], "6");
    assert.equal(mem.ifxBlocks.AA_STEP_SLICER["0"], "100");
  });

  it("patches type blocks via ifx ops and applyOpsToModel", () => {
    const mem = parseMemory(xml, 1);
    const next = applyOpsToModel(mem, [
      { type: "ifx", section: "AA_PREAMP", tags: { C: "77" } },
    ]);
    assert.equal(next.ifxBlocks.AA_PREAMP.C, "77");
    assert.equal(mem.ifxBlocks.AA_PREAMP.C, "50");

    const patched = patchIfxSection(xml, "AA_PREAMP", { C: "88" });
    const again = parseMemory(patched, 1);
    assert.equal(again.ifxBlocks.AA_PREAMP.C, "88");
  });

  it("copies Input FX type blocks between memories", () => {
    const source = patchIfxSection(xml, "AA_PREAMP", { C: "91" });
    const target = readFileSync(join(root, "fixtures", "DATA", "MEMORY002A.RC0"), "utf8");
    const { xml: out } = assemble({
      kind: "copy",
      sourceXml: source,
      targetXml: target,
      mode: "inputFx",
    });
    const src = parseMemory(source, 1);
    const dst = parseMemory(out, 2);
    assert.equal(src.ifxBlocks.AA_PREAMP?.C, "91");
    assert.equal(dst.ifxBlocks.AA_PREAMP?.C, "91");
    assert.equal(dst.ifxBlocks.AA_PREAMP?.A, src.ifxBlocks.AA_PREAMP?.A);
  });
});
