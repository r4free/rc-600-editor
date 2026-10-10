import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { barsToWire } from "../../web/src/rhythmConverter/barsWire.js";
import type { PartEvents } from "../../web/src/rhythmConverter/exportPack.js";
import type { SlotRecord } from "../../web/src/rhythmConverter/rhythmRc0.js";
import type { PlayedBar } from "../../web/src/rhythmConverter/scoreDrumEvents.js";
import { rhythmRoutes } from "./routes.js";

const api = rhythmRoutes();

function post(path: string, body: unknown, raw = false) {
  return api.request(path, {
    method: "POST",
    headers: { "Content-Type": raw ? "application/octet-stream" : "application/json" },
    body: raw ? (body as Uint8Array).slice() : JSON.stringify(body),
  });
}

const VAR_A: PartEvents = {
  role: "varA",
  notes: [
    { tick: 0, note: 36, velocity: 100, duration: 60 },
    { tick: 960, note: 38, velocity: 90, duration: 60 },
  ],
  lengthTicks: 1920,
  tempoBpm: 100,
  numerator: 4,
  denominator: 4,
  bars: 1,
};

function bar(index: number, notes: number[]): PlayedBar {
  return {
    index,
    masterBarIndex: index,
    numerator: 4,
    denominator: 4,
    lengthTicks: 1920,
    tempo: 120,
    section: null,
    hits: notes.map((note, i) => ({ tick: i * 480, note, velocity: 100 })),
  };
}

describe("rhythm routes", () => {
  it("encodes, writes and reads back a slot list", async () => {
    const enc = await post("/encode", { items: [{ parts: [VAR_A], name: "Rock", kit: 4 }] });
    const { records } = (await enc.json()) as { records: SlotRecord[] };
    assert.equal(records[0]!.name, "Rock");
    assert.equal(records[0]!.kit, 4);

    const file = new Uint8Array(await (await post("/write", { records: records.map((r) => r.data) })).arrayBuffer());
    let end = file.length;
    while (end > 12 && file[end - 1] === 0) end--;
    const back = (await (await post("/read", file.slice(0, end), true)).json()) as { records: SlotRecord[] };
    assert.deepEqual(back.records, records);

    const renamed = (await (await post("/rename", { data: records[0]!.data, name: "Funk" })).json()) as {
      record: SlotRecord;
    };
    assert.equal(renamed.record.name, "Funk");
  });

  it("suggests parts, kit and the Magic Wand from wire bars", async () => {
    const bars = barsToWire([0, 1, 2, 3].map((i) => bar(i, [36, 42, 38, 42])));
    const { plan } = (await (await post("/suggest", { bars, ppq: 480 })).json()) as { plan: Record<string, unknown> };
    assert.ok(plan.varA);
    const { options } = (await (await post("/auto-map", { bars, ppq: 480 })).json()) as { options: unknown[] };
    assert.ok(options.length >= 1);
    const { kit } = (await (await post("/kit", { bars, ppq: 480 })).json()) as { kit: { kit: number } | null };
    assert.equal(typeof kit?.kit, "number");
    const { guess } = (await (await post("/classify", { bars, ppq: 480, start: 1, end: 3 })).json()) as {
      guess: { kind: string };
    };
    assert.ok(guess.kind);
  });

  it("rejects bad input", async () => {
    assert.equal((await post("/read", new Uint8Array(20), true)).status, 400);
    assert.equal((await post("/encode", { items: [{ parts: [{ role: "nope" }] }] })).status, 400);
  });
});
