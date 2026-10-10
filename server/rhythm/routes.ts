/** `/api/rhythm/*`: RHYTHM.RC0 read/write, part suggestion, Magic Wand, kit guess and the MIDI pack. */
import { gzipSync } from "node:zlib";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { barsFromWire } from "../../web/src/rhythmConverter/barsWire.js";
import type { PartEvents } from "../../web/src/rhythmConverter/exportPack.js";
import { MAX_USER_PATTERNS } from "../../web/src/rhythmConverter/rhythmRc0.js";
import { PART_ROLES, type PartRole } from "../../web/src/rhythmConverter/sectionSuggest.js";
import { AUTO_MAP_MAX, autoMapOptions } from "./autoMap.js";
import { classifyBars, grooveFeatures, suggestKit } from "./grooveClassify.js";
import { buildRhythmPack } from "./pack.js";
import {
  RECORD_SIZE,
  encodeSlot,
  readRhythmRc0,
  recordFromData,
  renameRecord,
  slotFromRecord,
  writeRhythmRc0,
} from "./rc0.js";
import { suggestParts } from "./suggest.js";

const MAX_BODY = 8 * 1024 * 1024;
const MAX_NOTES = 20_000;

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function partsFromBody(raw: unknown): PartEvents[] {
  if (!Array.isArray(raw)) throw new Error("Invalid parts.");
  return raw.slice(0, PART_ROLES.length).map((p): PartEvents => {
    const r = (p ?? {}) as Record<string, unknown>;
    if (!PART_ROLES.includes(r.role as PartRole)) throw new Error("Invalid part role.");
    const notes = Array.isArray(r.notes) ? r.notes.slice(0, MAX_NOTES) : [];
    return {
      role: r.role as PartRole,
      notes: notes.map((n) => {
        const x = (n ?? {}) as Record<string, unknown>;
        return {
          tick: Math.round(num(x.tick, 0, 1e7, 0)),
          note: Math.round(num(x.note, 0, 127, 36)),
          velocity: Math.round(num(x.velocity, 1, 127, 100)),
          duration: Math.round(num(x.duration, 1, 1e5, 60)),
        };
      }),
      lengthTicks: Math.round(num(r.lengthTicks, 1, 1e7, 1920)),
      tempoBpm: num(r.tempoBpm, 20, 400, 120),
      numerator: Math.round(num(r.numerator, 1, 32, 4)),
      denominator: Math.round(num(r.denominator, 1, 32, 4)),
      bars: Math.round(num(r.bars, 1, 512, 1)),
      origin: typeof r.origin === "string" ? r.origin.slice(0, 200) : undefined,
    };
  });
}

function fail(c: Context, e: unknown) {
  return c.json({ error: e instanceof Error ? e.message : "Rhythm request failed" }, 400);
}

async function body(c: Context): Promise<Record<string, unknown>> {
  const raw = await c.req.json().catch(() => null);
  if (!raw || typeof raw !== "object") throw new Error("Invalid JSON");
  return raw as Record<string, unknown>;
}

function binary(c: Context, bytes: Uint8Array, type: string, fileName?: string) {
  c.header("Content-Type", type);
  c.header("Cache-Control", "no-store");
  if (fileName) c.header("X-File-Name", encodeURIComponent(fileName));
  if (/\bgzip\b/.test(c.req.header("accept-encoding") ?? "")) {
    c.header("Content-Encoding", "gzip");
    return c.body(gzipSync(bytes));
  }
  return c.body(new Uint8Array(bytes));
}

export function rhythmRoutes(): Hono {
  const api = new Hono();
  api.use("*", bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: "Request is too large" }, 413) }));

  /** Raw RHYTHM.RC0 bytes in (trailing zeros may be cut), decoded slots out. */
  api.post("/read", async (c) => {
    try {
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      const full = new Uint8Array(Math.max(bytes.length, 12));
      full.set(bytes);
      const records = readRhythmRc0(padFile(full)).map(slotFromRecord);
      return c.json({ records });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/write", async (c) => {
    try {
      const b = await body(c);
      if (!Array.isArray(b.records)) throw new Error("Invalid records.");
      if (b.records.length > MAX_USER_PATTERNS)
        throw new Error(`The RC-600 holds at most ${MAX_USER_PATTERNS} user rhythms.`);
      return binary(c, writeRhythmRc0(b.records.map(recordFromData)), "application/octet-stream", "RHYTHM.RC0");
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/encode", async (c) => {
    try {
      const b = await body(c);
      if (!Array.isArray(b.items) || b.items.length > MAX_USER_PATTERNS) throw new Error("Invalid rhythms.");
      const records = b.items.map((item) => {
        const it = (item ?? {}) as Record<string, unknown>;
        return encodeSlot(partsFromBody(it.parts), String(it.name ?? ""), Math.round(num(it.kit, 0, 63, 0)));
      });
      return c.json({ records });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/rename", async (c) => {
    try {
      const b = await body(c);
      return c.json({ record: slotFromRecord(renameRecord(recordFromData(b.data), String(b.name ?? ""))) });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/suggest", async (c) => {
    try {
      const b = await body(c);
      return c.json({ plan: suggestParts(barsFromWire(b.bars), num(b.ppq, 1, 1e5, 960)) });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/auto-map", async (c) => {
    try {
      const b = await body(c);
      return c.json({ options: autoMapOptions(barsFromWire(b.bars), num(b.ppq, 1, 1e5, 960), AUTO_MAP_MAX) });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/kit", async (c) => {
    try {
      const b = await body(c);
      const features = grooveFeatures(barsFromWire(b.bars), num(b.ppq, 1, 1e5, 960));
      return c.json({ kit: features.hits ? suggestKit(features) : null });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/classify", async (c) => {
    try {
      const b = await body(c);
      const bars = barsFromWire(b.bars);
      const start = Math.round(num(b.start, 0, bars.length, 0));
      const end = Math.round(num(b.end, start, bars.length, start));
      const { kind, kindReason, tags } = classifyBars(bars, start, end, num(b.ppq, 1, 1e5, 960));
      return c.json({ guess: { kind, kindReason, tags } });
    } catch (e) {
      return fail(c, e);
    }
  });

  api.post("/pack", async (c) => {
    try {
      const b = await body(c);
      const pack = buildRhythmPack(partsFromBody(b.parts), String(b.songName ?? "").slice(0, 120));
      return binary(c, pack.bytes, "application/zip", pack.fileName);
    } catch (e) {
      return fail(c, e);
    }
  });

  return api;
}

/** Restores the zero padding the browser cuts off before upload. */
function padFile(bytes: Uint8Array): Uint8Array {
  const used = new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, true);
  const want = 12 + Math.min(used, MAX_USER_PATTERNS * RECORD_SIZE);
  if (bytes.length >= want) return bytes;
  const out = new Uint8Array(want);
  out.set(bytes);
  return out;
}
