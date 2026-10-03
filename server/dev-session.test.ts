import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { editorSessionAllowed } from "./dev-session.js";

describe("editor session gate", () => {
  const originalFetch = globalThis.fetch;

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("allows the editor when the API accepts the license session", async () => {
    globalThis.fetch = (async () =>
      Response.json({ ok: true, requireLicense: true, mode: "license" })) as typeof fetch;
    assert.equal(await editorSessionAllowed("rc600_session=abc"), true);
  });

  it("keeps the activation page when the API rejects the session", async () => {
    globalThis.fetch = (async () =>
      Response.json({ ok: false, requireLicense: true, mode: "license" })) as typeof fetch;
    assert.equal(await editorSessionAllowed("rc600_session=abc"), false);
  });

  it("opens the editor when a license is not required", async () => {
    globalThis.fetch = (async () =>
      Response.json({ ok: true, requireLicense: false, mode: "open" })) as typeof fetch;
    assert.equal(await editorSessionAllowed(undefined), true);
  });
});
