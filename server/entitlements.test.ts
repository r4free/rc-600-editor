import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  featureAllowed,
  isLocalDevEnvironment,
  isValidFullPlanKey,
  resolveEntitlements,
  revokeDeviceForRequest,
  type EntitlementsSnapshot,
} from "./entitlements.js";
import { resetLicenseSeatsCache } from "./licenseSeats.js";

function fakeReq(opts?: { key?: string; deviceId?: string; ua?: string }): Request {
  const headers = new Headers();
  if (opts?.key) headers.set("x-rc600-plan-key", opts.key);
  if (opts?.deviceId) headers.set("x-rc600-device-id", opts.deviceId);
  if (opts?.ua) headers.set("user-agent", opts.ua);
  return new Request("http://localhost/api/entitlements", { headers });
}

describe("entitlements", () => {
  const prev = {
    FULL_FEATURES: process.env.RC600_FULL_FEATURES,
    PLAN_KEYS: process.env.RC600_FULL_PLAN_KEYS,
    PLAN_KEY: process.env.RC600_FULL_PLAN_KEY,
    RENDER: process.env.RENDER,
    NODE_ENV: process.env.NODE_ENV,
    SEATS: process.env.RC600_LICENSE_SEATS_PATH,
  };
  let dir: string;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rc600-ent-"));
    process.env.RC600_LICENSE_SEATS_PATH = join(dir, "seats.json");
    resetLicenseSeatsCache();
  });

  after(() => {
    for (const [k, v] of Object.entries({
      RC600_FULL_FEATURES: prev.FULL_FEATURES,
      RC600_FULL_PLAN_KEYS: prev.PLAN_KEYS,
      RC600_FULL_PLAN_KEY: prev.PLAN_KEY,
      RENDER: prev.RENDER,
      NODE_ENV: prev.NODE_ENV,
      RC600_LICENSE_SEATS_PATH: prev.SEATS,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetLicenseSeatsCache();
    rmSync(dir, { recursive: true, force: true });
  });

  it("treats non-production non-RENDER as localDev", () => {
    delete process.env.RC600_FULL_FEATURES;
    delete process.env.RENDER;
    process.env.NODE_ENV = "development";
    assert.equal(isLocalDevEnvironment(), true);
    const snap = resolveEntitlements(fakeReq());
    assert.equal(snap.unlocked, true);
    assert.equal(snap.features.setlists, true);
  });

  it("locks features in production without a key", () => {
    delete process.env.RC600_FULL_FEATURES;
    process.env.RENDER = "true";
    process.env.NODE_ENV = "production";
    process.env.RC600_FULL_PLAN_KEYS = "test-key-abc";
    resetLicenseSeatsCache();
    const locked = resolveEntitlements(fakeReq());
    assert.equal(locked.localDev, false);
    assert.equal(locked.unlocked, false);
    assert.equal(locked.features.setlists, false);
    assert.equal(locked.keyValid, false);
    assert.equal(locked.devices, undefined);
  });

  it("unlocks with a valid plan key and device in production", () => {
    delete process.env.RC600_FULL_FEATURES;
    process.env.RENDER = "true";
    process.env.NODE_ENV = "production";
    process.env.RC600_FULL_PLAN_KEYS = "test-key-abc,other";
    resetLicenseSeatsCache();
    assert.equal(isValidFullPlanKey("test-key-abc"), true);
    assert.equal(isValidFullPlanKey("nope"), false);
    const snap: EntitlementsSnapshot = resolveEntitlements(
      fakeReq({
        key: "test-key-abc",
        deviceId: "browser-device-1",
        ua: "Mozilla/5.0 Chrome/120 Windows",
      }),
    );
    assert.equal(snap.keyValid, true);
    assert.equal(snap.deviceBound, true);
    assert.equal(snap.fullPlan, true);
    assert.equal(snap.unlocked, true);
    assert.equal(snap.features.setlists, true);
    assert.equal(snap.devices?.length, 1);
    assert.equal(
      featureAllowed(fakeReq({ key: "test-key-abc", deviceId: "browser-device-1" }), "setlists"),
      true,
    );
  });

  it("valid key without device stays locked in production", () => {
    delete process.env.RC600_FULL_FEATURES;
    process.env.RENDER = "true";
    process.env.NODE_ENV = "production";
    process.env.RC600_FULL_PLAN_KEYS = "test-key-abc";
    resetLicenseSeatsCache();
    const snap = resolveEntitlements(fakeReq({ key: "test-key-abc" }));
    assert.equal(snap.keyValid, true);
    assert.equal(snap.unlocked, false);
    assert.equal(snap.deviceBound, false);
  });

  it("limits to 3 devices and exposes list when full", () => {
    delete process.env.RC600_FULL_FEATURES;
    process.env.RENDER = "true";
    process.env.NODE_ENV = "production";
    process.env.RC600_FULL_PLAN_KEYS = "limit-key-xyz";
    resetLicenseSeatsCache();

    for (const id of ["dev-aaaa-01", "dev-bbbb-02", "dev-cccc-03"]) {
      const s = resolveEntitlements(fakeReq({ key: "limit-key-xyz", deviceId: id }));
      assert.equal(s.unlocked, true, id);
    }
    const fourth = resolveEntitlements(fakeReq({ key: "limit-key-xyz", deviceId: "dev-dddd-04" }));
    assert.equal(fourth.keyValid, true);
    assert.equal(fourth.unlocked, false);
    assert.equal(fourth.deviceLimitReached, true);
    assert.equal(fourth.devices?.length, 3);
    assert.equal(
      featureAllowed(fakeReq({ key: "limit-key-xyz", deviceId: "dev-dddd-04" }), "setlists"),
      false,
    );
  });

  it("revoke then bind frees a seat", () => {
    delete process.env.RC600_FULL_FEATURES;
    process.env.RENDER = "true";
    process.env.NODE_ENV = "production";
    process.env.RC600_FULL_PLAN_KEYS = "revoke-key-xyz";
    resetLicenseSeatsCache();

    resolveEntitlements(fakeReq({ key: "revoke-key-xyz", deviceId: "rev-aaaa-01" }));
    resolveEntitlements(fakeReq({ key: "revoke-key-xyz", deviceId: "rev-bbbb-02" }));
    resolveEntitlements(fakeReq({ key: "revoke-key-xyz", deviceId: "rev-cccc-03" }));

    const revoked = revokeDeviceForRequest(
      fakeReq({ key: "revoke-key-xyz", deviceId: "rev-dddd-04" }),
      "rev-bbbb-02",
    );
    assert.equal(revoked.ok, true);
    assert.equal(revoked.entitlements.unlocked, false);

    const rebound = resolveEntitlements(fakeReq({ key: "revoke-key-xyz", deviceId: "rev-dddd-04" }));
    assert.equal(rebound.unlocked, true);
    assert.equal(rebound.deviceBound, true);
  });

  it("invalid key never returns device list", () => {
    delete process.env.RC600_FULL_FEATURES;
    process.env.RENDER = "true";
    process.env.NODE_ENV = "production";
    process.env.RC600_FULL_PLAN_KEYS = "real-key";
    resetLicenseSeatsCache();
    const snap = resolveEntitlements(fakeReq({ key: "fake-key", deviceId: "dev-xxxxx-01" }));
    assert.equal(snap.keyValid, false);
    assert.equal(snap.devices, undefined);
  });

  it("localDev ignores seat limits", () => {
    delete process.env.RC600_FULL_FEATURES;
    delete process.env.RENDER;
    process.env.NODE_ENV = "development";
    process.env.RC600_FULL_PLAN_KEYS = "any";
    resetLicenseSeatsCache();
    const snap = resolveEntitlements(fakeReq());
    assert.equal(snap.localDev, true);
    assert.equal(snap.unlocked, true);
  });
});
