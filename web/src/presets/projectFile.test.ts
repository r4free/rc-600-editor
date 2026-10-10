import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PatchOp } from "@rc600/rc0/ops";
import { slotFileName, systemFileName } from "@rc600/files/roland";
import {
  applyProject,
  commitMemoryOps,
  commitMemoryXml,
  commitSystemOps,
  describeProject,
  emptyCommitted,
  isProjectEmpty,
  parseProject,
  serializeProject,
  type ProjectState,
} from "./projectFile";

const op = (track: number, d: string): PatchOp => ({ type: "track", track, tags: { D: d } });
const sysOp: PatchOp = { type: "section", section: "SETUP", scope: "sys", tags: { A: "1" } };
const rhythmOp: PatchOp = { type: "section", section: "RHYTHM", tags: { D: "3" } };

function baseState(): ProjectState {
  const baseline = new Map<string, string>();
  for (const s of [1, 2, 3, 5]) {
    baseline.set(slotFileName(s, "A"), `<mem id="${s - 1}">base${s}</mem>`);
    baseline.set(slotFileName(s, "B"), `<mem id="${s - 1}">base${s}</mem>`);
  }
  baseline.set(systemFileName("1"), "<sys>base</sys>");
  return {
    files: new Map(baseline),
    baseline,
    drafts: new Map(),
    committed: emptyCommitted(),
    sysOps: [],
  };
}

describe("projectFile", () => {
  it("round-trips committed + pending edits for several slots and system", () => {
    let committed = commitMemoryOps(emptyCommitted(), 1, [op(1, "100")]);
    committed = commitSystemOps(committed, [sysOp]);
    const drafts = new Map<number, PatchOp[]>([
      [1, [op(2, "110")]],
      [2, [rhythmOp]],
      [3, [op(3, "90")]],
      [5, [{ type: "name", name: "Song 5" }]],
    ]);
    const project = serializeProject({
      committed,
      drafts,
      sysOps: [],
      nameOf: (s) => `M${s}`,
      createdAt: "2026-10-10T00:00:00.000Z",
    });
    assert.deepEqual(
      project.memories.map((m) => m.slot),
      [1, 2, 3, 5],
    );
    assert.deepEqual(project.memories[0].ops, [op(1, "100"), op(2, "110")]);
    assert.deepEqual(project.system?.ops, [sysOp]);
    assert.equal(describeProject(project), "Memories 1, 2, 3, 5 and System");

    const parsed = parseProject(JSON.stringify(project));
    assert.deepEqual(parsed, project);
  });

  it("keeps Mass Apply results as embedded memory data", () => {
    const committed = commitMemoryXml(emptyCommitted(), 4, '<mem id="3">copied</mem>');
    const project = serializeProject({ committed, drafts: new Map(), sysOps: [] });
    assert.equal(project.memories[0].xml, '<mem id="3">copied</mem>');
    assert.deepEqual(project.memories[0].ops, []);
  });

  it("rejects invalid files", () => {
    assert.throws(() => parseProject("nope"), /not valid JSON/);
    assert.throws(() => parseProject(JSON.stringify({ format: "x" })), /not an RC-600/);
    const bad = (memories: unknown, version = 1) =>
      JSON.stringify({ format: "rc600-editor-project", version, memories });
    assert.throws(() => parseProject(bad([], 2)), /Unsupported project version/);
    assert.throws(() => parseProject(bad([{ slot: 100, ops: [] }])), /slot must be 1/);
    assert.throws(() => parseProject(bad([{ slot: 0, ops: [] }])), /slot must be 1/);
    assert.throws(
      () => parseProject(bad([{ slot: 1, ops: [] }, { slot: 1, ops: [] }])),
      /more than once/,
    );
    assert.throws(
      () => parseProject(bad([{ slot: 1, ops: [{ type: "track", track: 9, tags: {} }] }])),
      /not valid/,
    );
  });

  it("imports memory 1 into memory 1 only", () => {
    const state = baseState();
    state.files.set(slotFileName(1, "A"), "<mem id=\"0\">saved earlier</mem>");
    state.committed = commitMemoryOps(emptyCommitted(), 1, [op(1, "50")]);
    state.drafts.set(2, [op(1, "70")]);
    const project = parseProject(
      JSON.stringify({
        format: "rc600-editor-project",
        version: 1,
        memories: [{ slot: 1, ops: [op(1, "120")] }],
      }),
    );
    const next = applyProject(project, state);
    assert.equal(next.files.get(slotFileName(1, "A")), state.baseline.get(slotFileName(1, "A")));
    assert.deepEqual(next.drafts.get(1), [op(1, "120")]);
    assert.deepEqual(next.drafts.get(2), [op(1, "70")]);
    assert.equal(next.committed.memories.has(1), false);
    assert.equal(next.files.get(slotFileName(3, "A")), state.files.get(slotFileName(3, "A")));
    assert.deepEqual(next.sysOps, []);
  });

  it("applies embedded memory data and system changes", () => {
    const state = baseState();
    state.files.set(systemFileName("1"), "<sys>saved</sys>");
    const project = parseProject(
      JSON.stringify({
        format: "rc600-editor-project",
        version: 1,
        memories: [{ slot: 5, xml: '<mem id="4">copied</mem>', ops: [rhythmOp] }],
        system: { ops: [sysOp] },
      }),
    );
    const next = applyProject(project, state);
    assert.equal(next.files.get(slotFileName(5, "B")), '<mem id="4">copied</mem>');
    assert.deepEqual(next.drafts.get(5), [rhythmOp]);
    assert.equal(next.committed.memories.get(5)?.xml, '<mem id="4">copied</mem>');
    assert.equal(next.files.get(systemFileName("1")), "<sys>base</sys>");
    assert.deepEqual(next.sysOps, [sysOp]);
  });

  it("an empty session serializes to an empty project", () => {
    const project = serializeProject({ committed: emptyCommitted(), drafts: new Map(), sysOps: [] });
    assert.equal(isProjectEmpty(project), true);
  });
});
