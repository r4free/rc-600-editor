export const SUPPORT_NOTICE_KEY = "rc600.supportNotice.v1";
export const GITHUB_SPONSORS_URL = "https://github.com/sponsors/r4free";

export type SupportNoticeKind = "first" | "returning";

export const SUPPORT_FEATURES = [
  "WAV Audio Manager",
  "Web MIDI Drum Pads",
  "Live Tuner",
  "Automated Setlists",
  "Hybrid Chart Guide",
] as const;

type StoredNotice = {
  visits: number;
};

let kindThisLoad: SupportNoticeKind | null = null;

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function readVisits(store: Storage | null): number {
  if (!store) return 0;
  try {
    const raw = store.getItem(SUPPORT_NOTICE_KEY);
    if (!raw) return 0;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return 0;
    const visits = (parsed as StoredNotice).visits;
    return typeof visits === "number" && Number.isFinite(visits) && visits > 0 ? Math.floor(visits) : 0;
  } catch {
    return 0;
  }
}

export function resetSupportNoticeCache(): void {
  kindThisLoad = null;
}

/** First page load is first-visit copy; later loads use the returning copy. Cached per load. */
export function takeSupportNoticeKind(store: Storage | null = storage()): SupportNoticeKind {
  if (kindThisLoad) return kindThisLoad;
  const visits = readVisits(store);
  const kind: SupportNoticeKind = visits < 1 ? "first" : "returning";
  if (store) {
    try {
      store.setItem(SUPPORT_NOTICE_KEY, JSON.stringify({ visits: visits + 1 } satisfies StoredNotice));
    } catch {
      /* quota / private mode */
    }
  }
  kindThisLoad = kind;
  return kind;
}

export function supportNoticeTitle(kind: SupportNoticeKind): string {
  return kind === "returning"
    ? "Great to have you back!"
    : "Help keep the RC-600 Web Editor alive! ❤️";
}
