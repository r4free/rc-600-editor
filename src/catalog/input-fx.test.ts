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
  inputFxSeqParams,
  inputFxSeqTargets,
  inputFxStepLayout,
  inputFxTypeParams,
  syncRateBeats,
  syncRateLabel,
} from "./input-fx.js";
import { displayParam, INPUT_FX_TYPE_OPTIONS } from "./params.js";
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

  it("decodes Chorus in the factory order: Lo Cut / High Cut enums, then D.Level and E.Level", () => {
    const chorus = inputFxTypeParams(48);
    assert.deepEqual(chorus.map((d) => d.name), ["Rate", "Depth", "Lo Cut", "High Cut", "D.Level", "E.Level"]);
    assert.deepEqual(inputFxDefaultTags(48), { A: "64", B: "50", C: "0", D: "29", E: "100", F: "50" });
    const label = (tag: string, v: number) => chorus.find((d) => d.tag === tag)!.options!.find((o) => o.value === v)?.label;
    assert.equal(label("C", 0), "FLAT");
    assert.equal(label("D", 29), "FLAT");
    assert.equal(label("D", 0), "20.0 Hz");
  });

  it("decodes the EQ effect in the guide order with gains, then band Freq / Q at the fixture defaults", () => {
    const eq = inputFxTypeParams(26);
    assert.equal(inputFxBlockName(26), "EQ");
    assert.deepEqual(
      eq.map((d) => d.name),
      ["Lo", "Lo-Mid", "Hi-Mid", "High", "Level", "Lo-Mid Freq", "Lo-Mid Q", "Hi-Mid Freq", "Hi-Mid Q"],
    );
    assert.deepEqual(inputFxDefaultTags(26), { A: "20", B: "20", C: "20", D: "20", E: "20", F: "16", G: "1", H: "22", I: "1" });
    const def = (tag: string) => eq.find((d) => d.tag === tag)!;
    assert.equal(displayParam(def("F"), 16), "800 Hz");
    assert.equal(displayParam(def("H"), 22), "3.15 kHz");
    assert.equal(displayParam(def("G"), 1), "1");
    assert.equal(def("F").options!.at(-1)!.label, "10.0 kHz");
  });

  it("decodes Tape Echo1 (time + cuts) and Tape Echo2 (tape speed + Bass / Treble) at the fixture defaults", () => {
    const echo1 = inputFxTypeParams(40);
    const echo2 = inputFxTypeParams(41);
    assert.equal(inputFxBlockName(40), "TAPE_ECHO");
    assert.equal(inputFxBlockName(41), "TAPE_ECHO_V505V2");
    assert.deepEqual(echo1.map((d) => d.name), ["Repeat Rate", "Intensity", "D.Level", "Low Cut", "High Cut", "E.Level"]);
    assert.deepEqual(echo2.map((d) => d.name), ["Repeat Rate", "Intensity", "D.Level", "Bass", "Treble", "E.Level"]);
    assert.deepEqual(inputFxDefaultTags(40), { A: "211", B: "50", C: "100", D: "0", E: "29", F: "50" });
    assert.deepEqual(inputFxDefaultTags(41), { A: "50", B: "50", C: "100", D: "50", E: "50", F: "50" });
    const def2 = (tag: string) => echo2.find((d) => d.tag === tag)!;
    assert.equal(displayParam(echo1.find((d) => d.tag === "A")!, 211), "200 ms");
    assert.equal(displayParam(def2("D"), 50), "0");
    assert.equal(displayParam(def2("E"), 0), "-50");
    assert.equal(def2("F").max, 120);
  });

  it("decodes Lo-Fi Bit Depth (OFF, 31–1) and Sample Rate (OFF, 1/2–1/32) at the guide defaults", () => {
    const lofi = inputFxTypeParams(7);
    const def = (tag: string) => lofi.find((d) => d.tag === tag)!;
    assert.equal(displayParam(def("A"), 0), "OFF");
    assert.equal(displayParam(def("A"), 1), "31");
    assert.equal(displayParam(def("A"), def("A").default!), "8");
    assert.equal(displayParam(def("A"), 31), "1");
    assert.equal(displayParam(def("B"), def("B").default!), "1/4");
    assert.equal(displayParam(def("B"), 31), "1/32");
  });

  it("decodes Auto Pan with Init Phase in degrees and Step Rate (OFF + sync rates)", () => {
    const pan = inputFxTypeParams(29);
    assert.deepEqual(pan.map((d) => d.name), ["Rate", "Waveform", "Depth", "Init Phase", "Step Rate"]);
    const def = (tag: string) => pan.find((d) => d.tag === tag)!;
    assert.equal(displayParam(def("D"), 90), "90°");
    assert.equal(displayParam(def("E"), 0), "OFF");
    assert.equal(displayParam(def("E"), 1), "4MEAS");
    assert.equal(displayParam(def("E"), 19), "0");
  });

  it("decodes the Reverb family in the factory order", () => {
    const names = (type: number) => inputFxTypeParams(type).map((d) => d.name);
    const tail = ["Lo Cut", "High Cut", "D.Level", "E.Level"];
    assert.deepEqual(names(49), ["Time", "Pre Delay", "Density", ...tail]);
    assert.deepEqual(names(50), ["Time", "Pre Delay", "Threshold", ...tail]);
    assert.deepEqual(names(51), ["Time", "Pre Delay", "Gate Time", ...tail]);
    assert.deepEqual(inputFxDefaultTags(49), { A: "30", B: "0", C: "4", D: "0", E: "29", F: "100", G: "50" });
    assert.deepEqual(inputFxDefaultTags(50), { A: "30", B: "0", C: "50", D: "0", E: "29", F: "100", G: "50" });
    assert.deepEqual(inputFxDefaultTags(51), { A: "5", B: "0", C: "5", D: "0", E: "29", F: "100", G: "50" });
    const reverb = inputFxTypeParams(49);
    const def = (tag: string) => reverb.find((d) => d.tag === tag)!;
    assert.equal(displayParam(def("A"), 30), "3.0 s");
    assert.equal(displayParam(def("B"), 120), "120 ms");
    assert.equal(def("D").options![0]!.label, "FLAT");
    assert.equal(def("E").options![29]!.label, "FLAT");
  });

  it("describes step sequencer layouts", () => {
    const tremolo = inputFxStepLayout(32)!;
    assert.equal(tremolo.source, "seq");
    assert.equal(tremolo.stepTags.length, 16);
    assert.equal(tremolo.stepTags[0], "G");
    assert.equal(tremolo.stepTags[15], "V");
    assert.equal(tremolo.stepMaxTag, "F");
    assert.equal(tremolo.target, "tremolo");
    assert.deepEqual(tremolo.targetPreviews, ["tremolo", "tremolo"]);
    assert.deepEqual(
      inputFxSeqParams(32).find((d) => d.tag === "D")!.options?.map((o) => o.label),
      ["Rate", "Depth"],
    );
    assert.equal(inputFxStepLayout(1)!.target, "filter");
    assert.equal(inputFxStepLayout(14)!.target, "pitch");
    assert.equal(inputFxStepLayout(30)!.target, "pan");

    const phaser = inputFxStepLayout(4)!;
    assert.equal(phaser.target, "phaser");
    assert.deepEqual(phaser.targetPreviews, ["phaser", "phaser", "phaser", "volume", "volume"]);
    assert.deepEqual(
      inputFxSeqParams(4).find((d) => d.tag === "D")!.options?.map((o) => o.label),
      ["Depth", "Resonance", "Manual", "D.Level", "E.Level"],
    );

    const flanger = inputFxStepLayout(5)!;
    assert.equal(flanger.target, "flanger");
    assert.deepEqual(flanger.targetPreviews, ["flanger", "flanger", "flanger", "flanger", "volume", "volume"]);
    assert.deepEqual(
      inputFxSeqParams(5).find((d) => d.tag === "D")!.options?.map((o) => o.label),
      ["Depth", "Resonance", "Manual", "Separation", "D.Level", "E.Level"],
    );

    const ring = inputFxStepLayout(9)!;
    assert.equal(ring.target, "ring");
    assert.deepEqual(ring.targetPreviews, ["ring"]);
    assert.deepEqual(inputFxTypeParams(9).map((d) => d.name), ["Frequency", "Balance", "Mode"]);

    const vibrato = inputFxStepLayout(33)!;
    assert.equal(vibrato.source, "seq");
    assert.equal(vibrato.target, "vibrato");
    assert.deepEqual(vibrato.targetPreviews, ["vibrato", "volume", "volume"]);
    assert.equal(vibrato.switchTag, "A");
    const target = inputFxSeqParams(33).find((d) => d.tag === "D")!;
    assert.equal(target.name, "Target");
    assert.deepEqual(target.options?.map((o) => o.label), ["Depth", "D.Level", "E.Level"]);
    assert.deepEqual(
      inputFxSeqParams(33).filter((d) => d.tag < "G").map((d) => d.name),
      ["Sequence", "Step Sync", "Retrigger", "Target", "Sequence Rate", "Step Max"],
    );
    for (const type of INPUT_FX_SEQ_TYPES) assert.ok(inputFxSeqTargets(type).length > 0, `type ${type}`);
    assert.deepEqual(
      inputFxTypeParams(33).map((d) => d.name),
      ["Rate", "Depth", "Color", "D.Level", "E.Level"],
    );

    const slicer = inputFxStepLayout(35)!;
    assert.equal(slicer.source, "block");
    assert.deepEqual([slicer.stepTags[0], slicer.stepTags[15]], ["S", "7"]);
    assert.deepEqual([slicer.lengthTags![0], slicer.lengthTags![15]], ["C", "R"]);
    assert.equal(slicer.rateTag, "A");
    const slicerParams = inputFxTypeParams(35);
    assert.equal(slicerParams.length, 37);
    assert.equal(slicerParams.find((p) => p.tag === "S")!.name, "Step 1 Level");
    assert.equal(slicerParams.find((p) => p.tag === "C")!.name, "Step 1 Length");
    assert.deepEqual(
      ["8", "9", "#"].map((tag) => slicerParams.find((p) => p.tag === tag)!.name),
      ["Depth", "Comp Threshold", "Comp Gain"],
    );
    assert.deepEqual(
      ["F", "G"].map((tag) => inputFxTypeParams(34).find((p) => p.tag === tag)!.name),
      ["Comp Threshold", "Comp Gain"],
    );

    assert.equal(inputFxStepLayout(34), null);
    assert.equal(inputFxStepLayout(23), null);
  });

  it("converts sync rates to beats", () => {
    assert.equal(syncRateLabel(14), "1/16");
    assert.equal(syncRateBeats(14), 0.25);
    assert.equal(syncRateLabel(8), "1/4");
    assert.equal(syncRateBeats(8), 1);
    assert.equal(syncRateBeats(2), 4);
    assert.equal(syncRateBeats(18), null);
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
