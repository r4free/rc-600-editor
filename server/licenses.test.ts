import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createLicense,
  findValidLicense,
  hashLicenseKey,
  requireLicenseEnabled,
} from "./licenses.js";

describe("licenses", () => {
  let dir: string;
  let prevPath: string | undefined;
  let prevRequire: string | undefined;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rc600-lic-"));
    prevPath = process.env.RC600_LICENSES_PATH;
    prevRequire = process.env.RC600_REQUIRE_LICENSE;
    process.env.RC600_LICENSES_PATH = join(dir, "licenses.json");
    delete process.env.RC600_REQUIRE_LICENSE;
  });

  after(() => {
    if (prevPath === undefined) delete process.env.RC600_LICENSES_PATH;
    else process.env.RC600_LICENSES_PATH = prevPath;
    if (prevRequire === undefined) delete process.env.RC600_REQUIRE_LICENSE;
    else process.env.RC600_REQUIRE_LICENSE = prevRequire;
    rmSync(dir, { recursive: true, force: true });
  });

  it("defaults to public mode", () => {
    assert.equal(requireLicenseEnabled(), false);
  });

  it("creates and validates a key before expiry", () => {
    const { key, record } = createLicense({ days: 14, note: "test" });
    assert.match(key, /^RC600-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    assert.equal(findValidLicense(key)?.id, record.id);
    assert.equal(hashLicenseKey(key.toLowerCase()), record.keyHash);
  });

  it("rejects unknown keys", () => {
    assert.equal(findValidLicense("RC600-DEAD-BEEF-0000"), null);
  });
});
