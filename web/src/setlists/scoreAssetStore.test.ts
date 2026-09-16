import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryScoreAssetStore, scoreAssetId } from "./scoreAssetStore";

describe("score asset storage", () => {
  it("creates stable content-addressed IDs", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    assert.equal(await scoreAssetId(bytes), await scoreAssetId(new Uint8Array(bytes)));
  });

  it("stores defensive byte copies and deletes assets", async () => {
    const store = createMemoryScoreAssetStore();
    const input = new Uint8Array([10, 20, 30]);
    const saved = await store.put("song.gp", input);
    input[0] = 99;
    assert.deepEqual((await store.get(saved.id))?.bytes, new Uint8Array([10, 20, 30]));
    assert.equal((await store.list()).length, 1);
    await store.delete(saved.id);
    assert.equal(await store.get(saved.id), null);
  });
});
