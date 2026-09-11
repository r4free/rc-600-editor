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
  patchMemoryName,
  patchTrack,
  prepareSaveXml,
  pickActiveXml,
  summarizePair,
} from "./memory.js";

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

  it("parses six tracks and sixteen assigns", () => {
    const model = parseMemory(fix("MEMORY001A.RC0"), 1);
    assert.equal(model.tracks.length, 6);
    assert.equal(model.assigns.length, 16);
    assert.ok(model.tracks[0].D);
    assert.equal(model.assigns[0].A, "1");
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
});
