import {
  SETLIST_CATALOG_VERSION,
  parseSetlistCatalog,
  serializeSetlistCatalog,
  upsertSetlist,
  type Setlist,
} from "./playlist";

export interface SetlistTransferBundle {
  type: "rc600-setlists";
  version: 2;
  exportedAt: string;
  setlists: ReturnType<typeof serializeSetlistCatalog>;
}

export interface ParsedSetlistTransfer {
  setlists: Setlist[];
}

export function createSetlistTransfer(setlists: readonly Setlist[]): SetlistTransferBundle {
  return {
    type: "rc600-setlists",
    version: 2,
    exportedAt: new Date().toISOString(),
    setlists: serializeSetlistCatalog(setlists),
  };
}

export function setlistTransferToJson(bundle: SetlistTransferBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function parseSetlistTransfer(raw: unknown): ParsedSetlistTransfer {
  if (!raw || typeof raw !== "object") throw new Error("Invalid setlist file");
  const bundle = raw as Partial<SetlistTransferBundle>;
  if (bundle.type !== "rc600-setlists" || bundle.version !== 2) {
    throw new Error("Unsupported setlist file");
  }
  const setlists = parseSetlistCatalog(bundle.setlists);
  if ((bundle.setlists as { version?: unknown } | undefined)?.version !== SETLIST_CATALOG_VERSION) {
    throw new Error("Unsupported setlist catalog version");
  }
  return { setlists };
}

export function mergeImportedSetlists(
  current: readonly Setlist[],
  imported: readonly Setlist[],
): Setlist[] {
  return imported.reduce((next, setlist) => upsertSetlist(next, setlist), [...current]);
}
