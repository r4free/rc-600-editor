import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { libraryPartFromEvents, partLibraryToJson } from "./partLibrary.js";
import { createPartLibraryRepository } from "./partLibraryRepository.js";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

const PART = libraryPartFromEvents(
  {
    role: "varA",
    notes: [{ tick: 0, note: 36, velocity: 100, duration: 60 }],
    lengthTicks: 1920,
    tempoBpm: 100,
    numerator: 4,
    denominator: 4,
    bars: 1,
  },
  { name: "Rock A", tags: ["Rock"], source: "user", id: "rock-a" },
);

describe("partLibraryRepository", () => {
  it("saves to this browser in production and lists factory parts from the JSON file", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(String(url));
      return new Response(partLibraryToJson([{ ...PART, id: "factory", name: "Factory" }]));
    }) as unknown as typeof fetch;
    const repo = createPartLibraryRepository({ mode: "production", storage: memoryStorage(), fetchImpl });
    assert.equal(repo.saveTarget(), "user");
    const saved = await repo.save(PART);
    assert.equal(saved.source, "user");
    const { native, user } = await repo.list();
    assert.deepEqual(native.map((p) => [p.id, p.source]), [["factory", "native"]]);
    assert.deepEqual(user.map((p) => p.id), ["rock-a"]);
    assert.ok(calls.every((u) => !u.startsWith("/api/rhythm-parts") || u === "/api/rhythm-parts"));
    await assert.rejects(repo.remove(native[0]!), /development/);
    await repo.remove(user[0]!);
    assert.equal((await repo.list()).user.length, 0);
  });

  it("posts to the API in development", async () => {
    let body = "";
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        body = String(init.body);
        return new Response(body, { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    const repo = createPartLibraryRepository({ mode: "development", storage: memoryStorage(), fetchImpl });
    const saved = await repo.save(PART);
    assert.equal(saved.source, "native");
    assert.equal(JSON.parse(body).name, "Rock A");
  });

  it("explains a stale API that has no rhythm-parts route", async () => {
    const fetchImpl = (async () => new Response("Not found", { status: 404 })) as unknown as typeof fetch;
    const repo = createPartLibraryRepository({ mode: "development", storage: memoryStorage(), fetchImpl });
    await assert.rejects(repo.save(PART), /Restart npm run api/);
  });

  it("exports and imports this browser's parts", () => {
    const a = createPartLibraryRepository({ mode: "production", storage: memoryStorage() });
    const b = createPartLibraryRepository({ mode: "production", storage: memoryStorage() });
    void a.save(PART);
    const file = a.exportUser();
    assert.equal(b.importUser(JSON.parse(file)), 1);
    assert.match(b.exportUser(), /Rock A/);
  });
});
