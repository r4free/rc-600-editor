import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  queryDirectoryPermission,
  requestDirectoryPermission,
  type DirectoryHandleLike,
} from "./roland.js";

function fakeHandle(
  query?: () => Promise<PermissionState>,
  request?: () => Promise<PermissionState>,
): DirectoryHandleLike {
  return {
    name: "ROLAND",
    entries: async function* () {},
    getDirectoryHandle: async () => fakeHandle(),
    getFileHandle: async () => ({
      getFile: async () => ({ text: async () => "" }) as File,
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
    }),
    queryPermission: query,
    requestPermission: request,
  };
}

describe("directory handle permissions", () => {
  it("returns unknown when the handle has no permission API", async () => {
    const handle = fakeHandle();
    delete handle.queryPermission;
    delete handle.requestPermission;
    assert.equal(await queryDirectoryPermission(handle), "unknown");
    assert.equal(await requestDirectoryPermission(handle), "unknown");
  });

  it("forwards query and request results", async () => {
    const handle = fakeHandle(
      async () => "prompt",
      async () => "granted",
    );
    assert.equal(await queryDirectoryPermission(handle), "prompt");
    assert.equal(await requestDirectoryPermission(handle), "granted");
  });
});
