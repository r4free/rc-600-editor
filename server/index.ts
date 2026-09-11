import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AssembleRequest } from "../src/rc0/ops.js";
import { assemble } from "../src/rc0/writer.js";
import {
  clearSessionCookie,
  createLicenseSessionToken,
  readSessionInfo,
  requireAccess,
  setSessionCookie,
} from "./session.js";
import {
  findValidLicense,
  licensePublic,
  requireLicenseEnabled,
} from "./licenses.js";

const app = new Hono();

app.get("/api/session", (c) => {
  return c.json(readSessionInfo(c));
});

/** Activate a license key (only meaningful when RC600_REQUIRE_LICENSE is on). */
app.post("/api/license", async (c) => {
  if (!requireLicenseEnabled()) {
    return c.json({
      ok: true,
      mode: "open" as const,
      requireLicense: false,
      license: null,
      message: "Public mode — license not required",
    });
  }
  let body: { key?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const key = String(body.key ?? "");
  const lic = findValidLicense(key);
  if (!lic) {
    return c.json({ error: "Invalid or expired license key" }, 401);
  }
  const token = createLicenseSessionToken(lic.id, lic.expiresAt);
  setSessionCookie(c, token);
  return c.json({
    ok: true,
    mode: "license" as const,
    requireLicense: true,
    license: licensePublic(lic),
  });
});

app.post("/api/lock", (c) => {
  clearSessionCookie(c);
  return c.json(readSessionInfo(c));
});

app.post("/api/assemble", requireAccess, async (c) => {
  let body: AssembleRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body !== "object" || !("kind" in body)) {
    return c.json({ error: "Invalid assemble request" }, 400);
  }
  try {
    if (body.kind === "patch") {
      if (typeof body.xml !== "string" || !Array.isArray(body.ops)) {
        return c.json({ error: "patch requires xml and ops" }, 400);
      }
    } else if (body.kind === "copy") {
      if (
        typeof body.sourceXml !== "string" ||
        typeof body.targetXml !== "string" ||
        (body.mode !== "all" && body.mode !== "assigns")
      ) {
        return c.json({ error: "copy requires sourceXml, targetXml, mode" }, 400);
      }
    } else {
      return c.json({ error: "Unknown kind" }, 400);
    }
    const result = assemble(body);
    return c.json(result);
  } catch (e) {
    console.error("assemble failed", e);
    return c.json({ error: "Assemble failed" }, 500);
  }
});

const distWeb = resolve(process.cwd(), "dist/web");
if (existsSync(distWeb)) {
  app.use("/*", serveStatic({ root: distWeb }));
  app.get("*", serveStatic({ root: distWeb, path: "index.html" }));
}

const port = Number(process.env.PORT || 5191);

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  const mode = requireLicenseEnabled() ? "license required" : "public (open)";
  console.log(`RC-600 API on http://127.0.0.1:${info.port} · ${mode}`);
  if (!existsSync(distWeb)) {
    console.log("(no dist/web — API only; use Vite proxy in dev)");
  }
});
