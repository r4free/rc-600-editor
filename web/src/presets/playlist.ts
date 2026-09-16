export const SETLIST_CATALOG_VERSION = 2;
export const USER_SETLISTS_STORAGE_KEY = "rc600.setlists";
export const LEGACY_PLAYLISTS_STORAGE_KEY = "rc600.playDrum.playlists";

export interface SetlistMidiAction {
  id: string;
  channel: number;
  controller: number;
  value: number;
  delayMs: number;
}

export interface SetlistSong {
  id: string;
  name: string;
  memorySlot: number;
  memoryName: string;
  beforeChange: SetlistMidiAction[];
  afterChange: SetlistMidiAction[];
}

export interface Setlist {
  id: string;
  name: string;
  updatedAt: string;
  songs: SetlistSong[];
}

export interface SetlistCatalog {
  version: number;
  setlists: Setlist[];
}

export async function executeSetlistSong(
  song: SetlistSong,
  deps: {
    sendControlChange: (action: SetlistMidiAction) => void;
    changeMemory: (slot: number) => Promise<void>;
    wait?: (ms: number) => Promise<void>;
    isCancelled?: () => boolean;
  },
): Promise<boolean> {
  const wait = deps.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const runActions = async (actions: readonly SetlistMidiAction[]) => {
    for (const action of actions) {
      if (deps.isCancelled?.()) return false;
      deps.sendControlChange(action);
      if (action.delayMs > 0) await wait(action.delayMs);
    }
    return !deps.isCancelled?.();
  };
  if (!(await runActions(song.beforeChange))) return false;
  await deps.changeMemory(song.memorySlot);
  if (deps.isCancelled?.()) return false;
  return runActions(song.afterChange);
}

export function clampMemorySlot(value: unknown): number {
  const parsed = Math.round(Number(value));
  return Math.max(1, Math.min(99, Number.isFinite(parsed) ? parsed : 1));
}

function cleanText(value: unknown, fallback: string, max = 80): string {
  if (typeof value !== "string") return fallback;
  return value.trim().replace(/\s+/g, " ").slice(0, max) || fallback;
}

function clampMidiByte(value: unknown): number {
  const parsed = Math.round(Number(value));
  return Math.max(0, Math.min(127, Number.isFinite(parsed) ? parsed : 0));
}

export function normalizeSetlistName(value: unknown): string {
  return cleanText(value, "Untitled setlist", 48);
}

export function newSetlistId(name: string): string {
  const slug =
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) ||
    "setlist";
  return `setlist-${slug}-${Date.now().toString(36)}`;
}

export function newSetlistItemId(prefix = "song"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseSetlistMidiAction(raw: unknown): SetlistMidiAction | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<SetlistMidiAction>;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  return {
    id: item.id.trim().slice(0, 100),
    channel: Math.max(1, Math.min(16, Math.round(Number(item.channel)) || 1)),
    controller: clampMidiByte(item.controller),
    value: clampMidiByte(item.value),
    delayMs: Math.max(0, Math.min(10_000, Math.round(Number(item.delayMs)) || 0)),
  };
}

function parseActions(raw: unknown): SetlistMidiAction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const action = parseSetlistMidiAction(item);
    return action ? [action] : [];
  });
}

export function parseSetlistSong(raw: unknown): SetlistSong | null {
  if (!raw || typeof raw !== "object") return null;
  const song = raw as Partial<SetlistSong> & {
    presetName?: unknown;
    beforeChange?: unknown;
    afterChange?: unknown;
  };
  if (typeof song.id !== "string" || !song.id.trim()) return null;
  return {
    id: song.id.trim().slice(0, 100),
    name: cleanText(song.name ?? song.presetName, "Untitled song"),
    memorySlot: clampMemorySlot(song.memorySlot),
    memoryName: cleanText(song.memoryName, ""),
    beforeChange: parseActions(song.beforeChange),
    afterChange: parseActions(song.afterChange),
  };
}

export function parseSetlist(raw: unknown): Setlist | null {
  if (!raw || typeof raw !== "object") return null;
  const setlist = raw as Partial<Setlist> & { songs?: unknown; items?: unknown };
  if (typeof setlist.id !== "string" || !setlist.id.trim()) return null;
  if (typeof setlist.name !== "string") return null;
  const songs: SetlistSong[] = [];
  const seen = new Set<string>();
  const rawSongs = Array.isArray(setlist.songs) ? setlist.songs : setlist.items;
  if (Array.isArray(rawSongs)) {
    for (const rawSong of rawSongs) {
      const song = parseSetlistSong(rawSong);
      if (!song || seen.has(song.id)) continue;
      seen.add(song.id);
      songs.push(song);
    }
  }
  const updatedAt =
    typeof setlist.updatedAt === "string" && Number.isFinite(Date.parse(setlist.updatedAt))
      ? setlist.updatedAt
      : new Date(0).toISOString();
  return {
    id: setlist.id.trim().slice(0, 80),
    name: normalizeSetlistName(setlist.name),
    updatedAt,
    songs,
  };
}

export function parseSetlistCatalog(raw: unknown): Setlist[] {
  if (!raw || typeof raw !== "object") return [];
  const catalog = raw as Partial<SetlistCatalog> & { playlists?: unknown };
  const rawSetlists = Array.isArray(catalog.setlists) ? catalog.setlists : catalog.playlists;
  if (!Array.isArray(rawSetlists)) return [];
  const setlists: Setlist[] = [];
  const seen = new Set<string>();
  for (const rawSetlist of rawSetlists) {
    const setlist = parseSetlist(rawSetlist);
    if (!setlist || seen.has(setlist.id)) continue;
    seen.add(setlist.id);
    setlists.push(setlist);
  }
  return setlists;
}

export function serializeSetlistCatalog(setlists: readonly Setlist[]): SetlistCatalog {
  return {
    version: SETLIST_CATALOG_VERSION,
    setlists: setlists.map((setlist) => ({
      ...setlist,
      songs: setlist.songs.map((song) => ({
        ...song,
        beforeChange: song.beforeChange.map((action) => ({ ...action })),
        afterChange: song.afterChange.map((action) => ({ ...action })),
      })),
    })),
  };
}

export function setlistsToJson(setlists: readonly Setlist[]): string {
  return `${JSON.stringify(serializeSetlistCatalog(setlists), null, 2)}\n`;
}

export function upsertSetlist(list: readonly Setlist[], incoming: Setlist): Setlist[] {
  const next = list.filter((setlist) => setlist.id !== incoming.id);
  next.push(incoming);
  return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function removeSetlist(list: readonly Setlist[], id: string): Setlist[] {
  return list.filter((setlist) => setlist.id !== id);
}

export function reorderSetlistSong(
  songs: readonly SetlistSong[],
  itemId: string,
  direction: -1 | 1,
): SetlistSong[] {
  const next = [...songs];
  const index = next.findIndex((item) => item.id === itemId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
