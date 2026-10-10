import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** License key management is local-only. These checks fail if a guard is removed. */
describe("license key management stays out of production", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

  it("compiles the Issue key UI out of production builds", () => {
    const slot = read("web/src/dev/DevLicenseSlot.tsx");
    assert.match(slot, /import\.meta\.env\.DEV\s*\?\s*lazy\(\(\) => import\("\.\/DevLicenseButton"\)\)/);
    const offenders = ["web/src/App.tsx", "web/src/main.tsx"].filter((path) => {
      try {
        return /from "\.\/dev\/DevLicenseButton"/.test(read(path));
      } catch {
        return false;
      }
    });
    assert.deepEqual(offenders, [], "DevLicenseButton must only be loaded through DevLicenseSlot");
  });

  it("gates every /api/dev/licenses route behind the local-only check", () => {
    const server = read("server/index.ts");
    const routes = [...server.matchAll(/app\.(get|post|patch|put|delete)\("\/api\/dev\/licenses[^"]*",[^\n]*\n([^\n]*)\n?([^\n]*)/g)];
    assert.ok(routes.length >= 4, "expected the issue, list, edit and delete routes");
    for (const [, method, line1, line2] of routes) {
      assert.match(`${line1}\n${line2}`, /devLicense(IssuerAllowed|RequestAllowed)/, `${method} route is not gated`);
    }
    assert.match(server, /c\.req\.path\.startsWith\("\/api\/dev\/licenses\/"\)/);
  });
});
