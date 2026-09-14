import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MemoryModel, TagMap } from "@rc600/rc0/memory";
import {
  buildMemoryFlowGraph,
  resolveMasterFxDestId,
} from "./memoryChainModel.js";

function emptyTags(): TagMap {
  return {};
}

function baseModel(overrides: Partial<MemoryModel> = {}): MemoryModel {
  const tracks: TagMap[] = Array.from({ length: 6 }, () => ({
    D: "100",
    H: "1",
    Q: "127",
    X: "1",
  }));
  const model: MemoryModel = {
    slot: 1,
    name: "TEST",
    count: "0001",
    tracks,
    master: emptyTags(),
    rec: emptyTags(),
    play: emptyTags(),
    rhythm: emptyTags(),
    assigns: Array.from({ length: 16 }, () => emptyTags()),
    ctlPedals: [],
    ectlCtl: [],
    ectlExp: [],
    input: { E: "0", F: "0", G: "0" },
    eq: {} as MemoryModel["eq"],
    output: { B: "0", C: "0", D: "0" },
    // Track bits all on MAIN L (A=63), inputs on MAIN L H include rhythm bit6
    routing: {
      A: "63",
      B: "0",
      C: "0",
      D: "0",
      E: "0",
      F: "0",
      G: "0",
      H: "64",
      I: "0",
      J: "0",
      K: "0",
      L: "0",
      M: "0",
      N: "0",
      O: "0",
      P: "0",
    },
    outputEq: {} as MemoryModel["outputEq"],
    masterFx: { C: "6" },
    mixer: {
      B: "0",
      D: "0",
      F: "0",
      H: "0",
      J: "0",
      L: "0",
      S: "100",
      T: "100",
    },
    ifxSetup: { A: "0" },
    ifxBanks: [{ A: "1", B: "1", C: "0" }, {}, {}, {}],
    ifxSlots: [
      [
        { A: "0", C: "0", D: "0" },
        { A: "0", C: "0", D: "0" },
        { A: "0", C: "0", D: "0" },
        { A: "0", C: "0", D: "0" },
      ],
      [{}, {}, {}, {}],
      [{}, {}, {}, {}],
      [{}, {}, {}, {}],
    ],
    ifxBlocks: {},
    tfxSetup: { A: "0" },
    tfxBlocks: {},
    tfxBanks: [{ A: "1", B: "1", C: "0" }, {}, {}, {}],
    tfxSlots: [
      [
        { A: "0", C: "0", D: "0" },
        { A: "0", C: "0", D: "0" },
        { A: "0", C: "0", D: "0" },
        { A: "0", C: "0", D: "0" },
      ],
      [{}, {}, {}, {}],
      [{}, {}, {}, {}],
      [{}, {}, {}, {}],
    ],
    raw: "",
  };
  return { ...model, ...overrides };
}

describe("memoryChainModel", () => {
  it("splits input and output L/R when stereo link is off", () => {
    const g = buildMemoryFlowGraph(baseModel());
    const inputs = g.nodes.filter((n) => n.kind === "input");
    assert.equal(inputs.length, 6);
    assert.ok(inputs.some((n) => n.label === "MIC 1"));
    assert.ok(inputs.some((n) => n.label === "MIC 2"));
    const dests = g.nodes.filter((n) => n.kind === "dest");
    assert.ok(dests.some((n) => n.label === "MAIN L"));
    assert.ok(dests.some((n) => n.label === "MAIN R"));
  });

  it("collapses MIC and MAIN when stereo link is on", () => {
    const g = buildMemoryFlowGraph(
      baseModel({
        input: { E: "1", F: "0", G: "0" },
        output: { B: "1", C: "0", D: "0" },
      }),
    );
    const inputs = g.nodes.filter((n) => n.kind === "input");
    assert.equal(inputs.filter((n) => n.label === "MIC" || n.label.startsWith("MIC")).length, 1);
    assert.ok(inputs.some((n) => n.label === "MIC"));
    assert.ok(!inputs.some((n) => n.label === "MIC 2"));
    const dests = g.nodes.filter((n) => n.kind === "dest");
    assert.ok(dests.some((n) => n.label === "MAIN"));
    assert.ok(!dests.some((n) => n.label === "MAIN R"));
  });

  it("places IFX A–D on every input lane; dims when Insert does not match", () => {
    const withAll = baseModel({
      ifxSlots: [
        [
          { A: "1", C: "1", D: "0" },
          { A: "0", C: "0", D: "0" },
          { A: "0", C: "0", D: "0" },
          { A: "0", C: "0", D: "0" },
        ],
        [{}, {}, {}, {}],
        [{}, {}, {}, {}],
        [{}, {}, {}, {}],
      ],
    });
    const gAll = buildMemoryFlowGraph(withAll);
    const ifxAll = gAll.nodes.filter((n) => n.kind === "ifx");
    // 6 input lanes × 4 slots
    assert.equal(ifxAll.length, 24);
    const activeAll = ifxAll.filter((n) => !n.inactive && n.label === "IFX A");
    assert.equal(activeAll.length, 6);

    const withMic1 = baseModel({
      ifxSlots: [
        [
          { A: "1", C: "5", D: "1" },
          { A: "0", C: "0", D: "0" },
          { A: "0", C: "0", D: "0" },
          { A: "0", C: "0", D: "0" },
        ],
        [{}, {}, {}, {}],
        [{}, {}, {}, {}],
        [{}, {}, {}, {}],
      ],
    });
    const gMic = buildMemoryFlowGraph(withMic1);
    const ifxA = gMic.nodes.filter((n) => n.kind === "ifx" && n.label === "IFX A");
    assert.equal(ifxA.length, 6);
    const activeMic = ifxA.filter((n) => !n.inactive);
    assert.equal(activeMic.length, 1);
    assert.equal(activeMic[0]?.key, "ifx:mic1:0:0");
  });

  it("always draws selected-bank IFX/TFX slots even when Switch is OFF", () => {
    const g = buildMemoryFlowGraph(baseModel());
    const ifx = g.nodes.filter((n) => n.kind === "ifx");
    const tfx = g.nodes.filter((n) => n.kind === "tfx");
    // 6 inputs × 4 IFX; 6 tracks × 4 TFX (all tracks have FX ON in baseModel)
    assert.equal(ifx.length, 24);
    assert.equal(tfx.length, 24);
    assert.ok(ifx.every((n) => n.inactive));
    assert.ok(tfx.every((n) => n.inactive));
  });

  it("skips Track FX nodes when track FX switch is off", () => {
    const tracks = Array.from({ length: 6 }, (_, i) => ({
      D: "100",
      H: i === 0 ? "0" : "1",
      Q: "127",
      X: "1",
    }));
    const model = baseModel({
      tracks,
      tfxSlots: [
        [
          { A: "1", C: "10", D: "0" },
          { A: "0", C: "0", D: "0" },
          { A: "0", C: "0", D: "0" },
          { A: "0", C: "0", D: "0" },
        ],
        [{}, {}, {}, {}],
        [{}, {}, {}, {}],
        [{}, {}, {}, {}],
      ],
    });
    const g = buildMemoryFlowGraph(model);
    const tfx = g.nodes.filter((n) => n.kind === "tfx");
    // Tracks 2–6 × 4 slots; track 1 bypasses
    assert.equal(tfx.length, 20);
    assert.ok(!tfx.some((n) => n.key.startsWith("tfx:1:")));
    assert.ok(g.edges.some((e) => e.id === "track:1->MIX"));
    const active = tfx.filter((n) => !n.inactive);
    assert.equal(active.length, 5); // TFX A on for tracks 2–6
  });

  it("shows PHONES only when Phones Out is INDIVIDUAL", () => {
    const normal = buildMemoryFlowGraph(baseModel());
    assert.ok(!normal.nodes.some((n) => n.selectId === "dest:phones"));

    const individual = buildMemoryFlowGraph(
      baseModel({
        routing: {
          ...baseModel().routing,
          O: "6",
          G: "1",
        },
      }),
    );
    assert.ok(individual.nodes.some((n) => n.selectId === "dest:phones"));
  });

  it("places Master FX after insert dest, dim when OFF", () => {
    const off = buildMemoryFlowGraph(baseModel({ masterFx: { C: "6" } }));
    const mfxOff = off.nodes.find((n) => n.kind === "mfx");
    assert.equal(mfxOff?.inactive, true);
    assert.ok(!off.edges.some((e) => e.to === "mfx"));

    const on = buildMemoryFlowGraph(baseModel({ masterFx: { C: "0" } }));
    assert.ok(on.edges.some((e) => e.from === "dest:main-l" && e.to === "mfx"));
    assert.equal(on.nodes.find((n) => n.kind === "mfx")?.inactive, false);
  });

  it("resolves Master FX insert onto linked MAIN when stereo linked", () => {
    assert.equal(
      resolveMasterFxDestId(1, { B: "1" }, { O: "0" }),
      "main-l",
    );
    assert.equal(resolveMasterFxDestId(6, { B: "0" }, { O: "0" }), null);
  });

  it("draws Input Thru send edges when ROUTING.P is on", () => {
    const g = buildMemoryFlowGraph(
      baseModel({
        routing: { ...baseModel().routing, P: "1" },
      }),
    );
    const thru = g.edges.filter((e) => e.id.endsWith("->MIX-thru"));
    assert.equal(thru.length, 6);
    assert.ok(thru.every((e) => e.kind === "send"));
  });

  it("lays out sources above MIX and MIX above destinations (top-down)", () => {
    const g = buildMemoryFlowGraph(baseModel());
    const mix = g.nodes.find((n) => n.kind === "mix")!;
    const input = g.nodes.find((n) => n.kind === "input")!;
    const ifx = g.nodes.find((n) => n.kind === "ifx")!;
    const dest = g.nodes.find((n) => n.kind === "dest")!;
    const mfx = g.nodes.find((n) => n.kind === "mfx")!;
    assert.ok(input.y < ifx.y);
    assert.ok(ifx.y < mix.y);
    assert.ok(mix.y < dest.y);
    assert.ok(dest.y < mfx.y);
    assert.ok(g.mixBus.width > g.mixBus.height);
  });
});
