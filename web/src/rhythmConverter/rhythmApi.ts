/** Rhythm Converter server calls: the RC-600 rhythm format and the part analysis run on the server. */
import { barsToWire } from "./barsWire";
import type { PartEvents } from "./exportPack";
import type { PartKind } from "./partLibrary";
import type { SlotRecord } from "./rhythmRc0";
import type { PlayedBar } from "./scoreDrumEvents";
import type { PartPlan } from "./sectionSuggest";

export interface AutoMapOption {
  plan: PartPlan;
  score: number;
  /** Short description, e.g. "3 variations · 3 fills · intro 4 bars · ending 1 bar". */
  summary: string;
}

export interface KitSuggestion {
  /** Index into the RC-600 rhythm kit list (0 Studio … 15 808+909). */
  kit: number;
  reason: string;
}

export interface GrooveGuess {
  kind: PartKind;
  /** Why this category was picked, in plain words. */
  kindReason: string;
  tags: string[];
}

async function failure(res: Response): Promise<Error> {
  if (res.status === 404)
    return new Error("The rhythm service is not available. Restart the editor server and try again.");
  if (res.status === 401 || res.status === 403)
    return new Error("Your license session has ended. Unlock the editor again.");
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(data?.error || `Rhythm request failed (${res.status}).`);
}

async function post(path: string, body: BodyInit, json: boolean, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`/api/rhythm/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": json ? "application/json" : "application/octet-stream" },
    body,
    signal,
  });
  if (!res.ok) throw await failure(res);
  return res;
}

async function postJson<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  return (await (await post(path, JSON.stringify(payload), true, signal)).json()) as T;
}

/** Decoded user rhythm slots of a RHYTHM.RC0 file. */
export async function readRhythmFile(bytes: Uint8Array): Promise<SlotRecord[]> {
  let end = bytes.length;
  while (end > 12 && bytes[end - 1] === 0) end--;
  const res = await post("read", bytes.slice(0, end), false);
  return ((await res.json()) as { records: SlotRecord[] }).records;
}

/** RHYTHM.RC0 bytes for these slots. */
export async function writeRhythmFile(records: readonly SlotRecord[]): Promise<Uint8Array> {
  const res = await post("write", JSON.stringify({ records: records.map((r) => r.data) }), true);
  return new Uint8Array(await res.arrayBuffer());
}

/** One pedal slot per item, built from converter parts. */
export async function encodeRhythms(
  items: readonly { parts: readonly PartEvents[]; name: string; kit: number }[],
): Promise<SlotRecord[]> {
  return (await postJson<{ records: SlotRecord[] }>("encode", { items })).records;
}

export async function renameSlot(record: SlotRecord, name: string): Promise<SlotRecord> {
  return (await postJson<{ record: SlotRecord }>("rename", { data: record.data, name })).record;
}

export async function suggestPlan(bars: readonly PlayedBar[], ppq: number): Promise<PartPlan> {
  return (await postJson<{ plan: PartPlan }>("suggest", { bars: barsToWire(bars), ppq })).plan;
}

export async function autoMapPlans(bars: readonly PlayedBar[], ppq: number): Promise<AutoMapOption[]> {
  return (await postJson<{ options: AutoMapOption[] }>("auto-map", { bars: barsToWire(bars), ppq })).options;
}

export async function guessKit(
  bars: readonly PlayedBar[],
  ppq: number,
  signal?: AbortSignal,
): Promise<KitSuggestion | null> {
  return (await postJson<{ kit: KitSuggestion | null }>("kit", { bars: barsToWire(bars), ppq }, signal)).kit;
}

export async function classifySelection(
  bars: readonly PlayedBar[],
  start: number,
  end: number,
  ppq: number,
  signal?: AbortSignal,
): Promise<GrooveGuess> {
  return (await postJson<{ guess: GrooveGuess }>("classify", { bars: barsToWire(bars), start, end, ppq }, signal))
    .guess;
}

/** ZIP with one MIDI file per part plus a README. */
export async function buildMidiPack(
  parts: readonly PartEvents[],
  songName: string,
): Promise<{ fileName: string; bytes: Uint8Array }> {
  const res = await post("pack", JSON.stringify({ parts, songName }), true);
  const fileName = decodeURIComponent(res.headers.get("X-File-Name") ?? "rc600_rhythm.zip");
  return { fileName, bytes: new Uint8Array(await res.arrayBuffer()) };
}
