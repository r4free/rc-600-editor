import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { licenseEmailSubject, licenseEmailText } from "./licenseEmail";

describe("licenseEmailText", () => {
  it("writes the permanent key email", () => {
    const text = licenseEmailText({ name: "  Ada Lovelace ", key: "RC600-22E2-185A-75D0" });
    assert.match(text, /^Dear Ada Lovelace,\n/);
    assert.match(text, /Here is your permanent license key:\n\nRC600-22E2-185A-75D0\n/);
    assert.match(text, /The license does not expire\. Keep this email/);
    assert.match(text, /Best regards$/);
  });

  it("states the dates of a dated key", () => {
    const text = licenseEmailText({
      name: "Ada",
      key: "RC600-0000-0000-0000",
      startsAt: new Date(2026, 9, 1).toISOString(),
      expiresAt: new Date(2026, 9, 10, 23, 59).toISOString(),
    });
    assert.match(text, /Here is your license key:/);
    assert.match(text, /valid from October 1, 2026 through October 10, 2026\./);
    assert.doesNotMatch(text, /does not expire/);
  });

  it("has a subject line", () => {
    assert.match(licenseEmailSubject(), /RC-600/);
  });
});
