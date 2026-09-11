import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAY_PARAMS,
  RHYTHM_PARAMS,
  TRACK_PARAMS,
  bitOn,
  displayParam,
  measureLabel,
  setBit,
} from "./params.js";
import { parseMemory } from "../rc0/memory.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const xml = readFileSync(join(root, "fixtures", "DATA", "MEMORY001A.RC0"), "utf8");

describe("track catalog", () => {
  it("maps TRACK1 fixture tags to Parameter Guide fields", () => {
    const track = parseMemory(xml, 1).tracks[0];
    assert.equal(track.D, "60");
    assert.equal(measureLabel(Number(track.R)), "2");
    assert.equal(track.S, "2");
    assert.equal(track.P, "0");
    assert.equal(Number(track.Q), 127);
    for (let bit = 0; bit < 7; bit++) assert.equal(bitOn(127, bit), true);
  });

  it("toggles a single INPUT bit without clearing the others", () => {
    assert.equal(setBit(127, 0, false), 126);
    assert.equal(bitOn(126, 0), false);
    assert.equal(bitOn(126, 6), true);
  });

  it("labels pan CENTER at 50", () => {
    const pan = TRACK_PARAMS.find((p) => p.tag === "C")!;
    assert.equal(displayParam(pan, 50), "CENTER");
    assert.equal(displayParam(pan, 40), "L10");
  });

  it("maps REC bounce tracks from tag F", () => {
    const rec = parseMemory(xml, 1).rec;
    assert.equal(Number(rec.F), 62);
    assert.equal(bitOn(62, 0), false);
    for (let bit = 1; bit < 6; bit++) assert.equal(bitOn(62, bit), true);
  });

  it("maps PLAY fixture tags to Parameter Guide fields", () => {
    const play = parseMemory(xml, 1).play;
    assert.equal(play.A, "0");
    assert.equal(play.B, "5");
    assert.equal(play.C, "5");
    assert.equal(Number(play.D), 63);
    assert.equal(Number(play.E), 63);
    assert.equal(play.F, "0");
    assert.equal(play.G, "0");
    assert.equal(play.H, "1");
    for (let bit = 0; bit < 6; bit++) {
      assert.equal(bitOn(63, bit), true);
    }
    const fadeIn = PLAY_PARAMS.find((p) => p.tag === "B")!;
    assert.equal(displayParam(fadeIn, 5), "2 meas");
    const loopLen = PLAY_PARAMS.find((p) => p.tag === "F")!;
    assert.equal(displayParam(loopLen, 0), "AUTO");
    const sync = PLAY_PARAMS.find((p) => p.tag === "H")!;
    assert.equal(displayParam(sync, 1), "Measure");
  });

  it("maps RHYTHM fixture tags to Parameter Guide fields", () => {
    const rhythm = parseMemory(xml, 1).rhythm;
    const genre = RHYTHM_PARAMS.find((p) => p.tag === "A")!;
    const beat = RHYTHM_PARAMS.find((p) => p.tag === "E")!;
    const kit = RHYTHM_PARAMS.find((p) => p.tag === "D")!;
    const variation = RHYTHM_PARAMS.find((p) => p.tag === "C")!;
    const start = RHYTHM_PARAMS.find((p) => p.tag === "F")!;
    assert.equal(displayParam(genre, Number(rhythm.A)), "Rock");
    assert.equal(rhythm.B, "0");
    assert.equal(displayParam(variation, Number(rhythm.C)), "A");
    assert.equal(displayParam(kit, Number(rhythm.D)), "Studio");
    assert.equal(displayParam(beat, Number(rhythm.E)), "4/4");
    assert.equal(displayParam(start, Number(rhythm.F)), "Before Loop");
    const xml2 = readFileSync(join(root, "fixtures", "DATA", "MEMORY002A.RC0"), "utf8");
    assert.equal(displayParam(genre, Number(parseMemory(xml2, 2).rhythm.A)), "Electro");
  });
});
