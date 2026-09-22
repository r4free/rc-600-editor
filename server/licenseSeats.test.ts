import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  ensureDeviceBound,
  hashPlanKey,
  isDeviceBound,
  isValidDeviceId,
  labelFromUserAgent,
  listDevicesForKey,
  MAX_DEVICES_PER_KEY,
  resetLicenseSeatsCache,
  revokeDevice,
} from "./licenseSeats.js";

describe("licenseSeats", () => {
  let dir: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rc600-seats-"));
    process.env.RC600_LICENSE_SEATS_PATH = join(dir, "seats.json");
    resetLicenseSeatsCache();
  });

  after(() => {
    resetLicenseSeatsCache();
    delete process.env.RC600_LICENSE_SEATS_PATH;
    rmSync(dir, { recursive: true, force: true });
  });

  it("hashes keys (not raw)", () => {
    const h = hashPlanKey("secret-key");
    assert.equal(h.length, 64);
    assert.notEqual(h, "secret-key");
  });

  it("validates device ids", () => {
    assert.equal(isValidDeviceId("abcd1234"), true);
    assert.equal(isValidDeviceId("a".repeat(8)), true);
    assert.equal(isValidDeviceId("short"), false);
    assert.equal(isValidDeviceId(""), false);
    assert.equal(isValidDeviceId("bad id!"), false);
  });

  it("labels user agents", () => {
    assert.match(
      labelFromUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ),
      /Chrome · Windows/,
    );
    assert.match(
      labelFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17 Safari/605.1.15",
      ),
      /Safari · macOS/,
    );
  });

  it("binds up to 3 devices then rejects the 4th", () => {
    resetLicenseSeatsCache();
    const key = "seat-test-key-alpha";
    const r1 = ensureDeviceBound(key, "device-aaa1", "Chrome · Windows");
    assert.equal(r1.ok, true);
    const r2 = ensureDeviceBound(key, "device-bbb2", "Edge · Windows");
    assert.equal(r2.ok, true);
    const r3 = ensureDeviceBound(key, "device-ccc3", "Firefox · macOS");
    assert.equal(r3.ok, true);
    assert.equal(MAX_DEVICES_PER_KEY, 3);

    const r4 = ensureDeviceBound(key, "device-ddd4", "Chrome · Linux");
    assert.equal(r4.ok, false);
    if (!r4.ok) assert.equal(r4.reason, "limit_reached");
    assert.equal(r4.devices.length, 3);
    assert.equal(isDeviceBound(key, "device-ddd4"), false);
    assert.equal(isDeviceBound(key, "device-aaa1"), true);
  });

  it("same UUID does not consume a second seat", () => {
    resetLicenseSeatsCache();
    const key = "seat-test-key-beta";
    assert.equal(ensureDeviceBound(key, "same-device-01", "A").ok, true);
    assert.equal(ensureDeviceBound(key, "same-device-01", "A updated").ok, true);
    assert.equal(listDevicesForKey(key, "same-device-01").length, 1);
  });

  it("revoke frees a seat for a new device", () => {
    resetLicenseSeatsCache();
    const key = "seat-test-key-gamma";
    ensureDeviceBound(key, "dev-one-01", "A");
    ensureDeviceBound(key, "dev-two-02", "B");
    ensureDeviceBound(key, "dev-three-3", "C");
    assert.equal(ensureDeviceBound(key, "dev-four-04", "D").ok, false);

    assert.equal(revokeDevice(key, "dev-two-02"), true);
    const bound = ensureDeviceBound(key, "dev-four-04", "D");
    assert.equal(bound.ok, true);
    assert.equal(isDeviceBound(key, "dev-two-02"), false);
    assert.equal(isDeviceBound(key, "dev-four-04"), true);
  });

  it("invalid device id does not write", () => {
    resetLicenseSeatsCache();
    const key = "seat-test-key-delta";
    const r = ensureDeviceBound(key, "bad", "X");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "invalid_device");
    assert.equal(listDevicesForKey(key, null).length, 0);
  });
});
