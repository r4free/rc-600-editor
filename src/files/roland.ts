import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

export interface RolandFiles {
  /** Relative path under ROLAND, e.g. DATA/MEMORY001A.RC0 */
  files: Map<string, string>;
  rootLabel: string;
}

export function normalizeRolandPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function slotFileName(slot: number, side: "A" | "B"): string {
  return `DATA/MEMORY${String(slot).padStart(3, "0")}${side}.RC0`;
}

export function systemFileName(side: "1" | "2"): string {
  return `DATA/SYSTEM${side}.RC0`;
}

export function listMemorySlots(files: Map<string, string>): number[] {
  const slots = new Set<number>();
  for (const key of files.keys()) {
    const m = key.match(/DATA\/MEMORY(\d{3})[AB]\.RC0$/i);
    if (m) slots.add(parseInt(m[1], 10));
  }
  return [...slots].sort((a, b) => a - b);
}

export function hasSystem(files: Map<string, string>): boolean {
  return files.has(systemFileName("1")) || files.has(systemFileName("2"));
}

/** Build a Map from FileList / drag-drop, keeping only ROLAND-relative paths. */
export async function filesFromFileList(list: FileList | File[]): Promise<RolandFiles> {
  const arr = [...list];
  const files = new Map<string, string>();
  let rootLabel = "ROLAND";

  for (const file of arr) {
    const rel = normalizeRolandPath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
    const idx = rel.toUpperCase().indexOf("ROLAND/");
    const path = idx >= 0 ? rel.slice(idx + "ROLAND/".length) : rel.replace(/^DATA\//i, "DATA/");
    if (!/\.(RC0|RCE)$/i.test(path)) continue;
    if (/EDITOR\.RCE$/i.test(path)) continue;
    const text = await file.text();
    files.set(normalizeRolandPath(path), text);
    if (idx >= 0) rootLabel = "ROLAND";
  }

  // If paths were just DATA/..., accept them
  if (files.size === 0) {
    for (const file of arr) {
      if (!/\.RC0$/i.test(file.name)) continue;
      const text = await file.text();
      files.set(`DATA/${file.name}`, text);
    }
  }

  return { files, rootLabel };
}

export async function filesFromZip(buffer: ArrayBuffer): Promise<RolandFiles> {
  const unzipped = unzipSync(new Uint8Array(buffer));
  const files = new Map<string, string>();
  for (const [name, data] of Object.entries(unzipped)) {
    const rel = normalizeRolandPath(name);
    const idx = rel.toUpperCase().indexOf("ROLAND/");
    const path = idx >= 0 ? rel.slice(idx + "ROLAND/".length) : rel;
    if (!/\.RC0$/i.test(path)) continue;
    if (/EDITOR\.RCE$/i.test(path)) continue;
    files.set(normalizeRolandPath(path), strFromU8(data));
  }
  return { files, rootLabel: "ROLAND.zip" };
}

export function zipRoland(files: Map<string, string>): Uint8Array {
  const obj: Record<string, Uint8Array> = {};
  for (const [path, text] of files) {
    obj[`ROLAND/${path}`] = strToU8(text);
  }
  return zipSync(obj);
}

export type DirectoryHandleLike = {
  name: string;
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirectoryHandleLike>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{
    getFile: () => Promise<File>;
    createWritable: (opts?: { keepExistingData?: boolean }) => Promise<{
      write: (d: string | BufferSource | Blob | Uint8Array) => Promise<void>;
      truncate?: (size: number) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
  removeEntry?: (name: string, opts?: { recursive?: boolean }) => Promise<void>;
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

export async function queryDirectoryPermission(
  handle: DirectoryHandleLike,
  mode: "read" | "readwrite" = "readwrite",
): Promise<PermissionState | "unknown"> {
  if (typeof handle.queryPermission !== "function") return "unknown";
  try {
    return await handle.queryPermission({ mode });
  } catch {
    return "unknown";
  }
}

export async function requestDirectoryPermission(
  handle: DirectoryHandleLike,
  mode: "read" | "readwrite" = "readwrite",
): Promise<PermissionState | "unknown"> {
  if (typeof handle.requestPermission !== "function") return "unknown";
  try {
    return await handle.requestPermission({ mode });
  } catch {
    return "unknown";
  }
}

async function walkDir(
  dir: DirectoryHandleLike,
  prefix: string,
  out: Map<string, string>,
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "directory") {
      if (name === "WAVE" || name.startsWith(".")) continue;
      await walkDir(handle as unknown as DirectoryHandleLike, `${prefix}${name}/`, out);
    } else if (handle.kind === "file") {
      if (!/\.RC0$/i.test(name)) continue;
      if (/EDITOR\.RCE$/i.test(name)) continue;
      const file = await (handle as unknown as { getFile: () => Promise<File> }).getFile();
      out.set(normalizeRolandPath(`${prefix}${name}`), await file.text());
    }
  }
}

async function findChildDirName(
  dir: DirectoryHandleLike,
  wantedUpper: string,
): Promise<string | null> {
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "file") continue;
    if (name.toUpperCase() === wantedUpper) return name;
  }
  return null;
}

export async function filesFromDirectoryHandle(dir: DirectoryHandleLike): Promise<{
  files: RolandFiles;
  handle: DirectoryHandleLike;
}> {
  // Prefer a root that contains both DATA and WAVE (true ROLAND folder).
  let root = dir;
  let label = dir.name;

  const rolandChild = await findChildDirName(dir, "ROLAND");
  if (rolandChild && dir.name.toUpperCase() !== "ROLAND" && dir.name.toUpperCase() !== "DATA") {
    root = await dir.getDirectoryHandle(rolandChild);
    label = rolandChild;
  } else if (dir.name.toUpperCase() !== "ROLAND" && dir.name.toUpperCase() !== "DATA") {
    // Folder may itself be a renamed Roland root (has DATA + WAVE)
    const dataChild = await findChildDirName(dir, "DATA");
    const waveChild = await findChildDirName(dir, "WAVE");
    if (dataChild && waveChild) {
      root = dir;
      label = dir.name;
    }
  }

  const files = new Map<string, string>();
  if (root.name.toUpperCase() === "DATA") {
    await walkDir(root, "DATA/", files);
  } else {
    await walkDir(root, "", files);
  }
  return { files: { files, rootLabel: label }, handle: root };
}

export async function writeFileToDirectory(
  root: DirectoryHandleLike,
  relativePath: string,
  content: string | Uint8Array | Blob,
): Promise<void> {
  const parts = normalizeRolandPath(relativePath).split("/");
  let dir = root;
  // If root is ROLAND, paths start with DATA/
  // If root is DATA, strip DATA/
  if (root.name.toUpperCase() === "DATA" && parts[0]?.toUpperCase() === "DATA") {
    parts.shift();
  }
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]!, { create: true });
  }
  const fileName = parts[parts.length - 1]!;
  const fh = await dir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable({ keepExistingData: false });
  if (typeof w.truncate === "function") await w.truncate(0);
  await w.write(content);
  await w.close();
}

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<DirectoryHandleLike>;
  }
}

export async function pickRolandDirectory(): Promise<{
  files: RolandFiles;
  handle: DirectoryHandleLike;
} | null> {
  if (!window.showDirectoryPicker) return null;
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  return filesFromDirectoryHandle(handle);
}
