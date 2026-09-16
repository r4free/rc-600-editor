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
import { ejectRc600Usb, isLocalUsbHost, listConnectedRolandVolumes } from "./usb-eject.js";
import {
  findTrackWaveFile,
  listMemoryWaveFiles,
  readWaveFileBytes,
} from "./wave-files.js";
import { createNativePresetFileStore, isNativePresetWriteAllowed } from "./drum-presets.js";
import { createNativeKitFileStore, isNativeKitWriteAllowed } from "./drum-kits.js";
import { AiRateLimiter, serializeAiLimit } from "./ai-rate-limit.js";
import { generateChartWithAi } from "./chart-ai.js";

try {
  process.loadEnvFile?.();
} catch {
  /* Environment variables may be supplied directly by the host. */
}
const app = new Hono();
const aiLimiter = new AiRateLimiter();
const nativePresetStore = createNativePresetFileStore(
  resolve(process.cwd(), "web/public/play-drum/presets.json"),
);
const nativeKitStore = createNativeKitFileStore(
  resolve(process.cwd(), "web/public/play-drum/kits.json"),
);

app.get("/api/session", (c) => {
  return c.json(readSessionInfo(c));
});

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    mode: requireLicenseEnabled() ? "license" : "open",
    hasDist: existsSync(resolve(process.cwd(), "dist/web")),
  });
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

app.get("/api/usb", async (c) => {
  const eject = isLocalUsbHost(c.req.header("host"));
  if (!eject) return c.json({ eject: false, connected: false });
  try {
    const volumes = await listConnectedRolandVolumes();
    return c.json({ eject: true, connected: volumes.length > 0 });
  } catch {
    return c.json({ eject: true, connected: false });
  }
});

/** List WAVE files for a memory slot from the connected RC-600 USB (local editor only). */
app.get("/api/wave/:slot", async (c) => {
  if (!isLocalUsbHost(c.req.header("host"))) {
    return c.json({ error: "WAVE access only runs on the local editor." }, 403);
  }
  const slot = Number(c.req.param("slot"));
  if (!Number.isInteger(slot) || slot < 1 || slot > 99) {
    return c.json({ error: "Invalid memory slot" }, 400);
  }
  try {
    const tracks = await listMemoryWaveFiles(slot);
    return c.json({
      slot,
      tracks: tracks.map((t) =>
        t
          ? { track: t.track, fileName: t.fileName, size: t.size }
          : null,
      ),
    });
  } catch (e) {
    console.error("wave list failed", e);
    return c.json({ error: "Could not list WAVE files" }, 500);
  }
});

/** Stream one track WAV from the connected RC-600 USB (local editor only). */
app.get("/api/wave/:slot/:track/file", async (c) => {
  if (!isLocalUsbHost(c.req.header("host"))) {
    return c.json({ error: "WAVE access only runs on the local editor." }, 403);
  }
  const slot = Number(c.req.param("slot"));
  const track = Number(c.req.param("track"));
  if (!Number.isInteger(slot) || slot < 1 || slot > 99) {
    return c.json({ error: "Invalid memory slot" }, 400);
  }
  if (!Number.isInteger(track) || track < 1 || track > 6) {
    return c.json({ error: "Invalid track" }, 400);
  }
  try {
    const info = await findTrackWaveFile(slot, track);
    if (!info) {
      return c.json({ error: `No WAV under WAVE/${String(slot).padStart(3, "0")}_${track}/` }, 404);
    }
    const bytes = readWaveFileBytes(info.absolutePath);
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename="${info.fileName.replace(/"/g, "")}"`,
        "X-Wave-File-Name": info.fileName,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("wave read failed", e);
    return c.json({ error: "Could not read WAVE file" }, 500);
  }
});

/** Eject the BOSS RC-600 mass-storage volume so the pedal can leave USB Storage and power off. Local editor only. */
app.post("/api/usb/eject", async (c) => {
  if (!isLocalUsbHost(c.req.header("host"))) {
    return c.json(
      {
        error:
          "USB eject only runs on the local editor. Release the folder here, then eject BOSS RC-600 from the OS.",
      },
      403,
    );
  }
  try {
    const result = await ejectRc600Usb();
    return c.json(result, result.ok ? 200 : 404);
  } catch (e) {
    console.error("usb eject failed", e);
    return c.json(
      {
        ok: false,
        error:
          "Could not eject the BOSS RC-600 drive. Eject it from File Explorer, wait for DISCONNECTING…, then power off.",
      },
      500,
    );
  }
});

app.get("/api/drum-presets", async (c) => {
  return c.json({ version: 1, presets: await nativePresetStore.list() });
});

app.post("/api/drum-presets", async (c) => {
  if (!isNativePresetWriteAllowed()) {
    return c.json({ error: "Factory rhythms are read-only in production" }, 403);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  try {
    const saved = await nativePresetStore.upsert(body);
    return c.json(saved);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save factory rhythm";
    return c.json({ error: message }, 400);
  }
});

app.delete("/api/drum-presets/:id", async (c) => {
  if (!isNativePresetWriteAllowed()) {
    return c.json({ error: "Factory rhythms are read-only in production" }, 403);
  }
  const id = c.req.param("id");
  const ok = await nativePresetStore.remove(id);
  if (!ok) return c.json({ error: "Rhythm not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/drum-kits", async (c) => {
  return c.json({ version: 1, kits: await nativeKitStore.list() });
});

app.post("/api/drum-kits", async (c) => {
  if (!isNativeKitWriteAllowed()) {
    return c.json({ error: "Factory kits are read-only in production" }, 403);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  try {
    const saved = await nativeKitStore.upsert(body);
    return c.json(saved);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save factory kit";
    return c.json({ error: message }, 400);
  }
});

app.delete("/api/drum-kits/:id", async (c) => {
  if (!isNativeKitWriteAllowed()) {
    return c.json({ error: "Factory kits are read-only in production" }, 403);
  }
  const id = c.req.param("id");
  const ok = await nativeKitStore.remove(id);
  if (!ok) return c.json({ error: "Kit not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/ai/limits", (c) => {
  return c.json({ ok: true, limits: serializeAiLimit(aiLimiter.peek(c.req.raw)) });
});

app.post("/api/setlists/chart/generate", async (c) => {
  let body: { prompt?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return c.json({ error: "Describe the song or chart you need" }, 400);
  if (prompt.length > 20_000) return c.json({ error: "The AI request is too long" }, 400);

  const quota = aiLimiter.consume(c.req.raw);
  if (!quota.allowed) {
    c.header("Retry-After", String(quota.retryAfterSec));
    return c.json(
      { error: quota.reason, limits: serializeAiLimit(quota) },
      429,
    );
  }
  try {
    const result = await generateChartWithAi(prompt);
    return c.json({
      ok: true,
      ...result,
      limits: serializeAiLimit(quota),
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "AI generation timed out"
        : error instanceof Error
          ? error.message
          : "Could not generate the chart";
    return c.json(
      { error: message, limits: serializeAiLimit(quota) },
      502,
    );
  }
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
      if (typeof body.sourceXml !== "string" || typeof body.targetXml !== "string") {
        return c.json({ error: "copy requires sourceXml, targetXml" }, 400);
      }
      const hasSelection = body.selection != null && typeof body.selection === "object";
      const modeOk =
        body.mode === "all" || body.mode === "assigns" || body.mode === "inputFx" || body.mode === undefined;
      if (!hasSelection && !modeOk) {
        return c.json({ error: "copy requires selection or mode" }, 400);
      }
      if (!hasSelection && body.mode === undefined) {
        return c.json({ error: "copy requires selection or mode" }, 400);
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
  // Never let the SPA catch /api/* — assemble must hit the JSON handlers above.
  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api")) return next();
    return serveStatic({ root: distWeb })(c, next);
  });
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api")) return next();
    return serveStatic({ root: distWeb, path: "index.html" })(c, next);
  });
}

const port = Number(process.env.PORT || 5191);
const hostname = process.env.HOST || "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, (info) => {
  const mode = requireLicenseEnabled() ? "license required" : "public (open)";
  console.log(`RC-600 API on http://${hostname}:${info.port} · ${mode}`);
  if (!existsSync(distWeb)) {
    console.log("(no dist/web — API only; use Vite proxy in dev)");
  }
});
