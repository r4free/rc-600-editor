import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { recordIssuedLicense, issuedLicensesPath } from "./issued-licenses.js";
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
  let prevIssued: string | undefined;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rc600-lic-"));
    prevPath = process.env.RC600_LICENSES_PATH;
    prevRequire = process.env.RC600_REQUIRE_LICENSE;
    prevIssued = process.env.RC600_ISSUED_LICENSES_PATH;
    process.env.RC600_LICENSES_PATH = join(dir, "licenses.json");
    process.env.RC600_ISSUED_LICENSES_PATH = join(dir, "issued-licenses.json");
    delete process.env.RC600_REQUIRE_LICENSE;
  });

  after(() => {
    if (prevPath === undefined) delete process.env.RC600_LICENSES_PATH;
    else process.env.RC600_LICENSES_PATH = prevPath;
    if (prevRequire === undefined) delete process.env.RC600_REQUIRE_LICENSE;
    else process.env.RC600_REQUIRE_LICENSE = prevRequire;
    if (prevIssued === undefined) delete process.env.RC600_ISSUED_LICENSES_PATH;
    else process.env.RC600_ISSUED_LICENSES_PATH = prevIssued;
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

  it("keeps the plaintext key in the local issued file", () => {
    const { key, record } = createLicense({ days: 10, note: "buyer@example.com" });
    recordIssuedLicense({
      id: record.id,
      key,
      note: record.note,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    });
    const saved = JSON.parse(readFileSync(issuedLicensesPath(), "utf8")) as {
      issued: { key: string; note?: string }[];
    };
    assert.equal(saved.issued[0]?.key, key);
    assert.equal(saved.issued[0]?.note, "buyer@example.com");
    assert.equal(readFileSync(join(dir, "licenses.json"), "utf8").includes(key), false);
  });
});
