import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SUPPORT_NOTICE_KEY,
  resetSupportNoticeCache,
  takeSupportNoticeKind,
  supportNoticeTitle,
} from "./notice";

function withLocalStorage<T>(fn: (store: Storage) => T): T {
  const data = new Map<string, string>();
  const previous = globalThis.localStorage;
  const store: Storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: store,
  });
  try {
    return fn(store);
  } finally {
    resetSupportNoticeCache();
    if (previous === undefined) Reflect.deleteProperty(globalThis, "localStorage");
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous });
  }
}

describe("support notice visits", () => {
  it("uses first-visit copy on the first load and caches it", () => {
    withLocalStorage((store) => {
      resetSupportNoticeCache();
      assert.equal(takeSupportNoticeKind(store), "first");
      assert.equal(takeSupportNoticeKind(store), "first");
      assert.equal(JSON.parse(store.getItem(SUPPORT_NOTICE_KEY) ?? "{}").visits, 1);
    });
  });

  it("uses returning copy on a later load", () => {
    withLocalStorage((store) => {
      resetSupportNoticeCache();
      takeSupportNoticeKind(store);
      resetSupportNoticeCache();
      assert.equal(takeSupportNoticeKind(store), "returning");
      assert.equal(JSON.parse(store.getItem(SUPPORT_NOTICE_KEY) ?? "{}").visits, 2);
    });
  });

  it("picks titles for each visit kind", () => {
    assert.equal(supportNoticeTitle("first"), "Help keep the RC-600 Web Editor alive! ❤️");
    assert.equal(supportNoticeTitle("returning"), "Great to have you back!");
  });
});
