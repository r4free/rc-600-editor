import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deleteLocalLicense,
  devLicenseIssuerAllowed,
  issueLocalLicense,
  listLocalLicenses,
  parseLicenseNote,
  updateLocalLicense,
} from "./dev-license.js";
import { findValidLicense } from "./licenses.js";

describe("dev license issuer", () => {
  let dir: string;
  let prevPath: string | undefined;
  let prevIssued: string | undefined;
  let prevLog: string | undefined;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rc600-dev-lic-"));
    prevPath = process.env.RC600_LICENSES_PATH;
    prevIssued = process.env.RC600_ISSUED_LICENSES_PATH;
    prevLog = process.env.RC600_LICENSE_LOG_PATH;
    process.env.RC600_LICENSES_PATH = join(dir, "licenses.json");
    process.env.RC600_ISSUED_LICENSES_PATH = join(dir, "issued-licenses.json");
    process.env.RC600_LICENSE_LOG_PATH = join(dir, "license-log.jsonl");
  });

  after(() => {
    if (prevLog === undefined) delete process.env.RC600_LICENSE_LOG_PATH;
    else process.env.RC600_LICENSE_LOG_PATH = prevLog;
    if (prevPath === undefined) delete process.env.RC600_LICENSES_PATH;
    else process.env.RC600_LICENSES_PATH = prevPath;
    if (prevIssued === undefined) delete process.env.RC600_ISSUED_LICENSES_PATH;
    else process.env.RC600_ISSUED_LICENSES_PATH = prevIssued;
    rmSync(dir, { recursive: true, force: true });
  });

  it("allows only a local development host", () => {
    assert.equal(devLicenseIssuerAllowed({}, "127.0.0.1:5191"), true);
    assert.equal(devLicenseIssuerAllowed({}, "rc.test"), true);
    assert.equal(devLicenseIssuerAllowed({}, "127.0.0.1:5191", "rc.test"), true);
    assert.equal(devLicenseIssuerAllowed({}, "localhost:5190"), true);
  });

  it("refuses production even if the host looks local", () => {
    assert.equal(devLicenseIssuerAllowed({ NODE_ENV: "production" }, "127.0.0.1:5191"), false);
    assert.equal(devLicenseIssuerAllowed({ RENDER: "true" }, "127.0.0.1:5191"), false);
    assert.equal(
      devLicenseIssuerAllowed({ NODE_ENV: "development", RENDER: "true" }, "localhost"),
      false,
    );
  });

  it("refuses a public host and a missing host", () => {
    assert.equal(devLicenseIssuerAllowed({}, "rc-600-editor.onrender.com"), false);
    assert.equal(devLicenseIssuerAllowed({}, "127.0.0.1:5191", "rc-600-editor.onrender.com"), false);
    assert.equal(devLicenseIssuerAllowed({}), false);
  });

  it("creates a key that never expires when both dates are empty", () => {
    const issued = issueLocalLicense({
      name: "Paul Camilleri",
      email: "Loochcam@gmail.com",
      location: "Eudlo QLD",
    });
    assert.match(issued.key, /^RC600-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    assert.equal(issued.expiresAt, undefined);
    assert.equal(issued.startsAt, undefined);
    assert.equal(issued.note, "loochcam@gmail.com-Paul Camilleri (Eudlo QLD)");
    assert.equal(findValidLicense(issued.key)?.id, issued.id);
  });

  it("creates a window when start and end are set", () => {
    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const issued = issueLocalLicense({
      name: "Martin Koehler",
      email: "mjkoehler1@gmx.de",
      startsAt,
      expiresAt,
    });
    assert.equal(issued.note, "mjkoehler1@gmx.de-Martin Koehler");
    assert.equal(issued.startsAt, new Date(startsAt).toISOString());
    assert.equal(issued.expiresAt, new Date(expiresAt).toISOString());
    assert.equal(findValidLicense(issued.key)?.id, issued.id);
  });

  it("rejects a key that has not started", () => {
    const issued = issueLocalLicense({
      name: "Later",
      email: "later@example.com",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    assert.equal(findValidLicense(issued.key), null);
  });

  it("rejects a missing name, a bad email, and an end before the start", () => {
    assert.throws(() => issueLocalLicense({ name: " ", email: "a@b.co" }), /Name is required/);
    assert.throws(() => issueLocalLicense({ name: "Ada", email: "not-an-email" }), /Email is required/);
    assert.throws(
      () =>
        issueLocalLicense({
          name: "Ada",
          email: "ada@example.com",
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        }),
      /End date is before the start date/,
    );
  });

  it("edits a key in both files and logs the change", () => {
    const issued = issueLocalLicense({ name: "Ada", email: "ada@example.com" });
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const updated = updateLocalLicense(issued.id, {
      name: "Ada Lovelace",
      email: "ADA@example.org",
      location: "London",
      expiresAt,
    });
    assert.equal(updated.name, "Ada Lovelace");
    assert.equal(updated.email, "ada@example.org");
    assert.equal(updated.location, "London");
    assert.equal(updated.expiresAt, expiresAt);
    assert.equal(updated.key, issued.key);
    assert.equal(findValidLicense(issued.key)?.note, "ada@example.org-Ada Lovelace (London)");

    const log = readLog().filter((line) => line.id === issued.id);
    assert.deepEqual(log.map((line) => line.action), ["create", "update"]);
    assert.equal(log[1]!.before.local.name, "Ada");
    assert.equal(log[1]!.after.local.name, "Ada Lovelace");
  });

  it("deletes a key from both files and keeps it in the log", () => {
    const issued = issueLocalLicense({ name: "Gone", email: "gone@example.com" });
    deleteLocalLicense(issued.id);
    assert.equal(findValidLicense(issued.key), null);
    assert.equal(listLocalLicenses().some((l) => l.id === issued.id), false);
    const last = readLog().filter((line) => line.id === issued.id).at(-1)!;
    assert.equal(last.action, "delete");
    assert.equal(last.before.local.key, issued.key);
    assert.throws(() => deleteLocalLicense(issued.id), /License not found/);
  });

  it("reads name, email and location from an older note", () => {
    assert.deepEqual(parseLicenseNote("loochcam@gmail.com-Paul Camilleri (Eudlo QLD)"), {
      email: "loochcam@gmail.com",
      name: "Paul Camilleri",
      location: "Eudlo QLD",
    });
    assert.deepEqual(parseLicenseNote("a@my-site.co.uk-Jo-Ann"), {
      email: "a@my-site.co.uk",
      name: "Jo-Ann",
      location: "",
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function readLog(): any[] {
    return readFileSync(join(dir, "license-log.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }
});
