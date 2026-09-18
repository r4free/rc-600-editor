import {
  SETLIST_CATALOG_VERSION,
  parseSetlistCatalog,
  serializeSetlistCatalog,
  upsertSetlist,
  type Setlist,
} from "./playlist";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { ScoreAsset, ScoreAssetStore } from "../setlists/scoreAssetStore";

export interface SetlistTransferAsset {
  id: string;
  fileName: string;
  mediaType: string;
  byteLength: number;
  path: string;
}

export interface SetlistTransferBundle {
  type: "boss-setlists" | "rc600-setlists";
  version: 4;
  exportedAt: string;
  setlists: ReturnType<typeof serializeSetlistCatalog>;
  assets?: SetlistTransferAsset[];
}

export interface ParsedSetlistTransfer {
  setlists: Setlist[];
  assets?: ScoreAsset[];
}

const TRANSFER_TYPES = new Set(["boss-setlists", "rc600-setlists"]);

export function createSetlistTransfer(setlists: readonly Setlist[]): SetlistTransferBundle {
  return {
    type: "boss-setlists",
    version: 4,
    exportedAt: new Date().toISOString(),
    setlists: serializeSetlistCatalog(setlists),
  };
}

export function setlistTransferToJson(bundle: SetlistTransferBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function parseSetlistTransfer(raw: unknown): ParsedSetlistTransfer {
  if (!raw || typeof raw !== "object") throw new Error("Invalid setlist file");
  const bundle = raw as {
    type?: unknown;
    version?: unknown;
    setlists?: unknown;
  };
  if (
    typeof bundle.type !== "string" ||
    !TRANSFER_TYPES.has(bundle.type) ||
    (bundle.version !== 2 && bundle.version !== 3 && bundle.version !== 4)
  ) {
    throw new Error("Unsupported setlist file");
  }
  const setlists = parseSetlistCatalog(bundle.setlists);
  const catalogVersion = (bundle.setlists as { version?: unknown } | undefined)?.version;
  if (
    catalogVersion !== 1 &&
    catalogVersion !== 2 &&
    catalogVersion !== 3 &&
    catalogVersion !== SETLIST_CATALOG_VERSION
  ) {
    throw new Error("Unsupported setlist catalog version");
  }
  return { setlists };
}

export async function createSetlistTransferArchive(
  setlists: readonly Setlist[],
  assetStore: ScoreAssetStore,
): Promise<Uint8Array> {
  const bundle = createSetlistTransfer(setlists);
  const files: Record<string, Uint8Array> = {};
  const assets: SetlistTransferAsset[] = [];
  const assetIds = [...new Set(setlists.flatMap((setlist) =>
    setlist.songs.flatMap((song) => song.music?.kind === "score" ? [song.music.assetId] : []),
  ))];
  for (const id of assetIds) {
    const asset = await assetStore.get(id);
    if (!asset) throw new Error(`Missing score asset ${id}`);
    const path = `assets/${id}.score`;
    files[path] = asset.bytes;
    assets.push({
      id,
      fileName: asset.fileName,
      mediaType: asset.mediaType,
      byteLength: asset.bytes.byteLength,
      path,
    });
  }
  const manifest: SetlistTransferBundle = { ...bundle, assets };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 6 });
}

export async function parseSetlistTransferFile(file: File): Promise<ParsedSetlistTransfer> {
  if (/\.json$/i.test(file.name)) {
    return parseSetlistTransfer(JSON.parse(await file.text()));
  }
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("Invalid setlist archive");
  }
  const manifestBytes = entries["manifest.json"];
  if (!manifestBytes) throw new Error("Setlist archive has no manifest");
  const manifest = JSON.parse(strFromU8(manifestBytes)) as SetlistTransferBundle;
  const parsed = parseSetlistTransfer(manifest);
  const assets: ScoreAsset[] = [];
  for (const metadata of manifest.assets ?? []) {
    if (!metadata.path.startsWith("assets/") || metadata.path.includes("..")) {
      throw new Error("Invalid score asset path");
    }
    const bytes = entries[metadata.path];
    if (!bytes || bytes.byteLength !== metadata.byteLength) {
      throw new Error(`Invalid score asset ${metadata.fileName}`);
    }
    assets.push({
      id: metadata.id,
      fileName: metadata.fileName,
      mediaType: metadata.mediaType,
      bytes,
      createdAt: new Date().toISOString(),
    });
  }
  return { ...parsed, assets };
}

export function mergeImportedSetlists(
  current: readonly Setlist[],
  imported: readonly Setlist[],
): Setlist[] {
  return imported.reduce((next, setlist) => upsertSetlist(next, setlist), [...current]);
}
