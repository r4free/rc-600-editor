import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { strFromU8, unzipSync } from "fflate";
import type { PartEvents } from "../../web/src/rhythmConverter/exportPack.js";
import { buildRhythmPack } from "./pack.js";

function part(role: PartEvents["role"], bars: number, origin?: string): PartEvents {
  return {
    role,
    notes: [{ tick: 0, note: 36, velocity: 100, duration: 60 }],
    lengthTicks: 480 * 4 * bars,
    tempoBpm: 99,
    numerator: 4,
    denominator: 4,
    bars,
    origin,
  };
}

describe("buildRhythmPack", () => {
  it("zips one SMF per part plus a README", () => {
    const pack = buildRhythmPack([part("varA", 2, "song bars 1-2"), part("fillA", 1)], "Canção Teste");
    assert.equal(pack.fileName, "Cancao_Teste_rc600_rhythm.zip");
    const files = unzipSync(pack.bytes);
    assert.deepEqual(Object.keys(files).sort(), [
      "Cancao_Teste/02_Var_A.mid",
      "Cancao_Teste/06_Fill_A.mid",
      "Cancao_Teste/README.txt",
    ]);
    assert.equal(strFromU8(files["Cancao_Teste/02_Var_A.mid"]!.slice(0, 4)), "MThd");
    const readme = strFromU8(files["Cancao_Teste/README.txt"]!);
    assert.match(readme, /RC Rhythm Converter/);
    assert.match(readme, /song bars 1-2/);
  });
});
