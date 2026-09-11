import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractCount,
  findSection,
  getTagContent,
  setTagContent,
  incrementCount,
  parseHexCount,
  activeSide,
} from "./xml-ops.js";
import {
  decodeName,
  parseMemory,
  parseSystem,
  pickActiveSystem,
  pickActiveXml,
  summarizePair,
  systemAsMemoryModel,
} from "./memory.js";
import {
  patchIfxSection,
  patchMemSection,
  patchMemoryName,
  patchTrack,
  prepareSaveXml,
  assemble,
} from "./writer.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fix = (name: string) => readFileSync(join(root, "fixtures", "DATA", name), "utf8");

describe("xml-ops", () => {
  it("finds sections and tags", () => {
    const xml = fix("MEMORY001A.RC0");
    const mem = findSection(xml, "mem");
    assert.ok(mem);
    const name = findSection(xml, "NAME", mem![0], mem![1]);
    assert.ok(name);
    assert.equal(getTagContent(xml, "A", name![0], name![1]), "82");
  });

  it("setTagContent only changes the target", () => {
    const xml = "<TRACK1>\n  <D>100</D>\n  <H>1</H>\n</TRACK1>";
    const next = setTagContent(xml, "D", "150")!;
    assert.equal(getTagContent(next, "D"), "150");
    assert.equal(getTagContent(next, "H"), "1");
    assert.ok(next.includes("<D>150</D>"));
  });

  it("increments count after database", () => {
    const xml = fix("MEMORY001A.RC0");
    const before = parseHexCount(extractCount(xml));
    const next = incrementCount(xml);
    assert.equal(parseHexCount(extractCount(next)), before + 1);
    assert.ok(next.indexOf("</database>") < next.indexOf("<count>"));
  });

  it("picks higher count as active", () => {
    assert.equal(activeSide("0013", "0014"), "b");
    assert.equal(activeSide("0014", "0013"), "a");
  });
});

describe("memory parse/patch", () => {
  it("decodes memory name Rock", () => {
    const xml = fix("MEMORY001A.RC0");
    const mem = findSection(xml, "mem")!;
    assert.equal(decodeName(xml, mem), "Rock");
  });

  it("parses six tracks, sixteen assigns, and CTL pedals", () => {
    const model = parseMemory(fix("MEMORY001A.RC0"), 1);
    assert.equal(model.tracks.length, 6);
    assert.equal(model.assigns.length, 16);
    assert.ok(model.tracks[0].D);
    assert.equal(model.assigns[0].A, "1");
    assert.equal(model.ctlPedals.length, 3);
    assert.equal(model.ctlPedals[0].length, 9);
    assert.equal(model.ctlPedals[0][0].A, "4");
    assert.equal(model.ectlCtl.length, 4);
    assert.equal(model.ectlExp.length, 2);
    assert.equal(model.eq.EQ_MIC1.A, "0");
    assert.equal(model.eq.EQ_INST1R.B, "20");
    assert.equal(model.outputEq.EQ_MAINOUTL.J, "23");
    assert.equal(model.masterFx.A, "0");
    assert.equal(model.mixer.A, "100");
    assert.equal(model.mixer.B, "0");
    assert.equal(model.ifxSetup.A, "0");
    assert.equal(model.ifxBanks[0].C, "1");
    assert.equal(model.ifxSlots[0][0].C, "23");
    assert.equal(model.ifxSlots[1][0].C, "41");
  });

  it("round-trips an Input FX bank and slot patch without touching SETUP", () => {
    const xml = fix("MEMORY001A.RC0");
    const bankPatched = patchIfxSection(xml, "A", { B: "1" });
    const slotPatched = patchIfxSection(bankPatched, "AA", { A: "1", C: "48" });
    const model = parseMemory(slotPatched, 1);
    assert.equal(model.ifxSetup.A, "0");
    assert.equal(model.ifxBanks[0].A, "1");
    assert.equal(model.ifxBanks[0].B, "1");
    assert.equal(model.ifxBanks[0].C, "1");
    assert.equal(model.ifxSlots[0][0].A, "1");
    assert.equal(model.ifxSlots[0][0].C, "48");
    assert.equal(model.ifxSlots[0][1].C, "22");
  });

  it("round-trips an INPUT EQ patch", () => {
    const xml = fix("MEMORY001A.RC0");
    const patched = patchMemSection(xml, "EQ_MIC1", { A: "1", B: "24" });
    const model = parseMemory(patched, 1);
    assert.equal(model.eq.EQ_MIC1.A, "1");
    assert.equal(model.eq.EQ_MIC1.B, "24");
    assert.equal(model.eq.EQ_MIC2.A, "0");
  });

  it("round-trips a MASTER FX patch", () => {
    const xml = fix("MEMORY001A.RC0");
    const patched = patchMemSection(xml, "MASTER_FX", { A: "12", C: "6" });
    const model = parseMemory(patched, 1);
    assert.equal(model.masterFx.A, "12");
    assert.equal(model.masterFx.B, "0");
    assert.equal(model.masterFx.C, "6");
  });

  it("round-trips name patch without rewriting unrelated bytes", () => {
    const xml = fix("MEMORY001A.RC0");
    const patched = patchMemoryName(xml, "TestLoop");
    const mem = findSection(patched, "mem")!;
    assert.equal(decodeName(patched, mem), "TestLoop");
    // Unrelated track level unchanged
    const t1 = findSection(patched, "TRACK1", mem[0], mem[1])!;
    const origT1 = findSection(xml, "TRACK1", findSection(xml, "mem")![0], findSection(xml, "mem")![1])!;
    assert.equal(getTagContent(patched, "D", t1[0], t1[1]), getTagContent(xml, "D", origT1[0], origT1[1]));
  });

  it("round-trips play level patch", () => {
    const xml = fix("MEMORY001A.RC0");
    const patched = patchTrack(xml, 1, { D: "180" });
    const model = parseMemory(patched, 1);
    assert.equal(model.tracks[0].D, "180");
    const saved = prepareSaveXml(patched);
    assert.ok(parseHexCount(extractCount(saved)) > parseHexCount(extractCount(xml)));
  });

  it("round-trips a pedal CTL function patch", () => {
    const xml = fix("MEMORY001A.RC0");
    const patched = patchMemSection(xml, "ICTL1_PEDAL1", { A: "2", C: "1" });
    const model = parseMemory(patched, 1);
    assert.equal(model.ctlPedals[0][0].A, "2");
    assert.equal(model.ctlPedals[0][1].A, "30");
  });

  it("summarizes A/B pair", () => {
    const summary = summarizePair(1, fix("MEMORY001A.RC0"), fix("MEMORY001B.RC0"));
    assert.equal(summary.slot, 1);
    assert.ok(summary.name.length > 0);
    assert.ok(summary.active === "a" || summary.active === "b");
    const picked = pickActiveXml(fix("MEMORY001A.RC0"), fix("MEMORY001B.RC0"));
    assert.equal(picked.side, summary.active);
  });
});

describe("system parse", () => {
  it("parses SYSTEM1 sections", () => {
    const sys = parseSystem(fix("SYSTEM1.RC0"), "1");
    assert.ok(sys.sections.SETUP);
    assert.ok(sys.sections.MIDI);
    assert.ok(sys.sections.MIXER);
    assert.ok(sys.count);
  });

  it("picks the active SYSTEM side by count", () => {
    const picked = pickActiveSystem(fix("SYSTEM1.RC0"), fix("SYSTEM2.RC0"));
    assert.ok(picked);
    assert.ok(picked!.side === "1" || picked!.side === "2");
    assert.ok(picked!.xml.includes("<sys>"));
  });

  it("exposes system INPUT/CTL through systemAsMemoryModel", () => {
    const model = systemAsMemoryModel(fix("SYSTEM1.RC0"));
    assert.ok(Object.keys(model.input).length > 0);
    assert.equal(model.ctlPedals.length, 3);
    assert.equal(model.ctlPedals[0]!.length, 9);
  });
});

describe("assemble (server writer)", () => {
  it("applies patch ops and increments count", () => {
    const xml = fix("MEMORY001A.RC0");
    const before = parseHexCount(extractCount(xml));
    const { xml: out } = assemble({
      kind: "patch",
      xml,
      ops: [{ type: "track", track: 1, tags: { D: "180" } }],
    });
    assert.equal(parseMemory(out, 1).tracks[0].D, "180");
    assert.equal(parseHexCount(extractCount(out)), before + 1);
  });

  it("copies assigns between memories", () => {
    const source = fix("MEMORY001A.RC0");
    const target = fix("MEMORY002A.RC0");
    const { xml: out } = assemble({
      kind: "copy",
      sourceXml: source,
      targetXml: target,
      mode: "assigns",
    });
    const src = parseMemory(source, 1);
    const dst = parseMemory(out, 2);
    assert.equal(dst.assigns[0].A, src.assigns[0].A);
    assert.equal(dst.assigns[0].G, src.assigns[0].G);
  });
});
