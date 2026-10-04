import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createLicense } from "./licenses.js";
import { createLicenseSessionToken } from "./session.js";
import {
  activationPageHtml,
  appShellAllowed,
  decidePaidShell,
  isActivationImage,
  demoViewAllowed,
  demoViewCookie,
  isDemoDocument,
  isFormActivation,
  isPublicApiPath,
  shellRequestKind,
} from "./shell-gate.js";

describe("shell gate", () => {
  let dir: string;
  let prevPath: string | undefined;
  let prevRequire: string | undefined;
  let prevSecret: string | undefined;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "rc600-shell-"));
    prevPath = process.env.RC600_LICENSES_PATH;
    prevRequire = process.env.RC600_REQUIRE_LICENSE;
    prevSecret = process.env.RC600_SESSION_SECRET;
    process.env.RC600_LICENSES_PATH = join(dir, "licenses.json");
    delete process.env.RC600_REQUIRE_LICENSE;
    delete process.env.RC600_SESSION_SECRET;
  });

  after(() => {
    if (prevPath === undefined) delete process.env.RC600_LICENSES_PATH;
    else process.env.RC600_LICENSES_PATH = prevPath;
    if (prevRequire === undefined) delete process.env.RC600_REQUIRE_LICENSE;
    else process.env.RC600_REQUIRE_LICENSE = prevRequire;
    if (prevSecret === undefined) delete process.env.RC600_SESSION_SECRET;
    else process.env.RC600_SESSION_SECRET = prevSecret;
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps activation HTML free of editor scripts", () => {
    const html = activationPageHtml('bad <script>alert("x")</script>');
    assert.match(html, /src="\/rc600-front.png"/);
    assert.match(html, /alt="BOSS RC-600 Loop Station"/);
    assert.match(html, /Your RC-600, easier to organize/);
    assert.match(html, /Shape every memory/);
    assert.match(html, /action="\/api\/license"/);
    assert.match(html, /href="\/demo"/);
    assert.match(html, /View a demo/);
    assert.match(html, /System requirements/);
    assert.match(html, /<dialog id="system-requirements"/);
    assert.match(html, /showModal\(\)/);
    assert.match(html, /phone, or tablet/);
    assert.match(html, /Web MIDI Browser/);
    assert.match(html, /apps\.apple\.com\/app\/web-midi-browser/);
    assert.match(html, /href="\/guia.html"/);
    assert.match(html, /Get a license/);
    assert.match(html, /https:\/\/buy\.stripe\.com\/cNicN62zPgLL38J8O94Ni00/);
    assert.equal(html.includes("<script"), false);
    assert.equal(html.includes("/assets/"), false);
    assert.equal(html.includes("/src/main"), false);
    assert.match(html, /bad &lt;script&gt;/);
  });

  it("classifies editor files separately from the activation page", () => {
    assert.equal(shellRequestKind("/"), "document");
    assert.equal(shellRequestKind("/index.html"), "document");
    assert.equal(shellRequestKind("/loop"), "document");
    assert.equal(shellRequestKind("/api/license"), "api");
    assert.equal(shellRequestKind("/assets/index-abc.js"), "asset");
    assert.equal(shellRequestKind("/guia.html"), "guide");
    assert.equal(shellRequestKind("/guia.js"), "guide");
    assert.equal(shellRequestKind("/guia.css"), "guide");
    assert.equal(shellRequestKind("/guide-images/editor-overview.png"), "guide");
    assert.equal(isActivationImage("/rc600-front.png"), true);
    assert.equal(isActivationImage("/rc600-front.png?v=1"), true);
    assert.equal(decidePaidShell("/rc600-front.png", false).action, "next");
    assert.equal(decidePaidShell("/guia.html", false).action, "next");
    assert.equal(shellRequestKind("/src/main.tsx?t=1"), "asset");
    assert.equal(shellRequestKind("/@vite/client"), "asset");
    assert.equal(isPublicApiPath("/api/license"), true);
    assert.equal(isPublicApiPath("/api/assemble"), false);
    assert.equal(isFormActivation("application/x-www-form-urlencoded"), true);
    assert.equal(isFormActivation("application/json"), false);
  });

  it("serves the editor only after a valid license cookie", async () => {
    process.env.RC600_REQUIRE_LICENSE = "1";
    const { key, record } = createLicense({ days: 7, note: "shell" });
    const token = createLicenseSessionToken(record.id, record.expiresAt);
    assert.equal(appShellAllowed(undefined), false);
    assert.equal(appShellAllowed(`rc600_session=${token}`), true);
    assert.equal(decidePaidShell("/", false).action, "page");
    assert.equal(isDemoDocument("/demo"), true);
    assert.equal(isDemoDocument("/demo/"), true);
    assert.equal(decidePaidShell("/demo", false).action, "demo");
    assert.equal(decidePaidShell("/assets/app.js", false).action, "deny");
    assert.equal(decidePaidShell("/assets/app.js", false, true).action, "next");
    assert.equal(demoViewAllowed(undefined), false);
    assert.equal(demoViewAllowed("rc600_demo=1"), true);
    assert.equal(decidePaidShell("/", false, true).action, "page");
    assert.equal(decidePaidShell("/assets/app.js", true).action, "next");

    const app = new Hono();
    app.use("*", async (c, next) => {
      const cookie = c.req.header("cookie");
      const decision = decidePaidShell(c.req.path, appShellAllowed(cookie), demoViewAllowed(cookie));
      if (decision.action === "demo") {
        c.header("Set-Cookie", demoViewCookie());
        return next();
      }
      if (decision.action === "next") return next();
      c.header("Cache-Control", "no-store");
      if (decision.action === "page") return c.html(decision.html, 200);
      return c.body(null, 404);
    });
    app.post("/api/license", async (c) => {
      const body = await c.req.parseBody();
      const submitted = typeof body.key === "string" ? body.key : "";
      if (submitted !== key) return c.html(activationPageHtml("Invalid or expired license key"), 401);
      c.header(
        "Set-Cookie",
        `rc600_session=${token}; Path=/; HttpOnly; SameSite=Lax`,
      );
      return c.redirect("/", 303);
    });
    app.get("/assets/app.js", (c) => c.text("window.SECRET_EDITOR=1"));
    app.get("/guia.html", (c) => c.text("USER_GUIDE"));
    app.get("/demo", (c) => c.html('<script type="module" src="/assets/app.js"></script>'));
    app.get("/", (c) => c.html('<script type="module" src="/assets/app.js"></script>'));

    const locked = await app.request("http://localhost/");
    const lockedHtml = await locked.text();
    assert.equal(locked.status, 200);
    assert.match(lockedHtml, /Welcome back/);
    assert.equal(lockedHtml.includes("SECRET_EDITOR"), false);
    assert.equal(lockedHtml.includes('type="module"'), false);
    assert.equal(locked.headers.get("cache-control"), "no-store");

    const asset = await app.request("http://localhost/assets/app.js");
    assert.equal(asset.status, 404);
    assert.equal(await asset.text(), "");

    const demo = await app.request("http://localhost/demo");
    assert.equal(demo.status, 200);
    assert.match(await demo.text(), /type="module"/);
    assert.match(demo.headers.get("set-cookie") ?? "", /rc600_demo=1/);

    const demoAsset = await app.request("http://localhost/assets/app.js", {
      headers: { cookie: "rc600_demo=1" },
    });
    assert.equal(demoAsset.status, 200);

    const stillLocked = await app.request("http://localhost/", {
      headers: { cookie: "rc600_demo=1" },
    });
    const stillLockedHtml = await stillLocked.text();
    assert.match(stillLockedHtml, /Welcome back/);
    assert.equal(stillLockedHtml.includes("SECRET_EDITOR"), false);

    const guide = await app.request("http://localhost/guia.html");
    assert.equal(guide.status, 200);
    assert.equal(await guide.text(), "USER_GUIDE");

    const bad = await app.request("http://localhost/api/license", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "key=RC600-NOPE-NOPE-NOPE",
    });
    assert.equal(bad.status, 401);
    const badHtml = await bad.text();
    assert.match(badHtml, /Invalid or expired license key/);
    assert.equal(badHtml.includes("SECRET_EDITOR"), false);

    const posted = await app.request("http://localhost/api/license", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `key=${encodeURIComponent(key)}`,
    });
    assert.equal(posted.status, 303);
    const cookie = posted.headers.get("set-cookie") ?? "";
    assert.match(cookie, /rc600_session=/);

    const opened = await app.request("http://localhost/", {
      headers: { cookie: `rc600_session=${token}` },
    });
    assert.match(await opened.text(), /SECRET_EDITOR|type="module"/);

    const bundle = await app.request("http://localhost/assets/app.js", {
      headers: { cookie: `rc600_session=${token}` },
    });
    assert.equal(bundle.status, 200);
    assert.match(await bundle.text(), /SECRET_EDITOR/);

    delete process.env.RC600_REQUIRE_LICENSE;
    assert.equal(appShellAllowed(undefined), true);
  });
});
