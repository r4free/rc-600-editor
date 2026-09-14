import type { DirectoryHandleLike } from "./roland.js";
import { normalizeRolandPath } from "./roland.js";

export type TrackNo = 1 | 2 | 3 | 4 | 5 | 6;

export type TrackWavInfo = {
  /** Relative path under ROLAND, e.g. WAVE/001_1/001_1.WAV */
  path: string;
  fileName: string;
  size: number;
};

export type WaveAccessProbe = {
  rootName: string;
  waveOk: boolean;
  waveDirName: string | null;
  message: string | null;
};

function padSlot(slot: number): string {
  return String(slot).padStart(3, "0");
}

/** Directory for one track: WAVE/{NNN}_{T}/ */
export function waveTrackDir(slot: number, track: number, waveDirName = "WAVE"): string {
  return `${waveDirName}/${padSlot(slot)}_${track}`;
}

/** Canonical pedal file name inside that directory. */
export function waveTrackFileName(slot: number, track: number): string {
  return `${padSlot(slot)}_${track}.WAV`;
}

export function waveTrackPath(slot: number, track: number, waveDirName = "WAVE"): string {
  return `${waveTrackDir(slot, track, waveDirName)}/${waveTrackFileName(slot, track)}`;
}

type WritableFileHandle = {
  getFile: () => Promise<File>;
  createWritable: (opts?: { keepExistingData?: boolean }) => Promise<{
    write: (d: string | BufferSource | Blob | Uint8Array) => Promise<void>;
    truncate?: (size: number) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type DirWithRemove = DirectoryHandleLike & {
  removeEntry?: (name: string, opts?: { recursive?: boolean }) => Promise<void>;
  values?: () => AsyncIterableIterator<FileSystemHandle & { name: string }>;
  keys?: () => AsyncIterableIterator<string>;
};

function isFileHandle(handle: FileSystemHandle): boolean {
  return handle.kind === "file";
}

function isDirHandle(handle: FileSystemHandle): boolean {
  return handle.kind === "directory";
}

const WAVE_NAME_STORE = "rc600.waveFileNames";

export function rememberWavFileName(slot: number, track: number, fileName: string): void {
  try {
    const raw = localStorage.getItem(WAVE_NAME_STORE);
    const all = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    all[`${slot}:${track}`] = fileName;
    localStorage.setItem(WAVE_NAME_STORE, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

export function rememberedWavFileName(slot: number, track: number): string | null {
  try {
    const raw = localStorage.getItem(WAVE_NAME_STORE);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, string>;
    return all[`${slot}:${track}`] ?? null;
  } catch {
    return null;
  }
}

/** Enumerate children via entries/values/keys — USB/FAT hosts are inconsistent. */
async function listDirectoryChildren(
  dir: DirWithRemove,
): Promise<Array<{ name: string; handle: FileSystemHandle }>> {
  const byName = new Map<string, { name: string; handle: FileSystemHandle }>();

  const add = (name: string, handle: FileSystemHandle) => {
    if (!name) return;
    byName.set(name.toUpperCase(), { name, handle });
  };

  try {
    for await (const [name, handle] of dir.entries()) {
      add(name, handle);
    }
  } catch {
    /* entries() flaky on some removable volumes */
  }

  if (typeof dir.values === "function") {
    try {
      for await (const handle of dir.values()) {
        add(handle.name, handle);
      }
    } catch {
      /* ignore */
    }
  }

  if (typeof dir.keys === "function") {
    try {
      for await (const name of dir.keys()) {
        if (byName.has(name.toUpperCase())) continue;
        try {
          const fh = await dir.getFileHandle(name);
          byName.set(name.toUpperCase(), {
            name,
            handle: { kind: "file", name, getFile: () => fh.getFile() } as unknown as FileSystemHandle,
          });
        } catch {
          try {
            await dir.getDirectoryHandle(name);
            byName.set(name.toUpperCase(), {
              name,
              handle: { kind: "directory", name } as unknown as FileSystemHandle,
            });
          } catch {
            /* neither */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return [...byName.values()];
}

async function listWavChildren(
  dir: DirWithRemove,
): Promise<Array<{ name: string; handle: FileSystemHandle; file: File }>> {
  const out: Array<{ name: string; handle: FileSystemHandle; file: File }> = [];
  for (const { name, handle } of await listDirectoryChildren(dir)) {
    if (!/\.WAV$/i.test(name)) continue;
    if (handle.kind === "directory") continue;
    const file = await fileFromChild(dir, name, handle);
    if (file) out.push({ name, handle, file });
  }
  // Prefer larger files (skip empty stubs)
  out.sort((a, b) => b.file.size - a.file.size);
  return out;
}

/** Find a child directory by name (case-insensitive). */
async function findChildDirectory(
  parent: DirectoryHandleLike,
  wanted: string,
  create: boolean,
): Promise<{ name: string; dir: DirWithRemove }> {
  try {
    const dir = (await parent.getDirectoryHandle(wanted, { create })) as DirWithRemove;
    return { name: wanted, dir };
  } catch {
    if (create) throw new Error(`Cannot create directory “${wanted}”`);
  }

  const target = wanted.toUpperCase();
  for (const { name, handle } of await listDirectoryChildren(parent as DirWithRemove)) {
    if (handle.kind === "file") continue;
    if (name.toUpperCase() !== target) continue;
    try {
      const dir = (await parent.getDirectoryHandle(name, { create: false })) as DirWithRemove;
      return { name, dir };
    } catch {
      continue;
    }
  }
  throw new Error(`Directory “${wanted}” not found under “${parent.name}”`);
}

async function resolveDir(
  root: DirectoryHandleLike,
  relativePath: string,
  create: boolean,
): Promise<{ dir: DirWithRemove; parts: string[] }> {
  const parts = normalizeRolandPath(relativePath).split("/").filter(Boolean);
  let dir = root as DirWithRemove;
  if (root.name.toUpperCase() === "DATA" && parts[0]?.toUpperCase() === "DATA") {
    parts.shift();
  }
  for (const part of parts) {
    const found = await findChildDirectory(dir, part!, create);
    dir = found.dir;
  }
  return { dir, parts };
}

async function getParentAndName(
  root: DirectoryHandleLike,
  relativePath: string,
  createParents: boolean,
): Promise<{ parent: DirWithRemove; name: string }> {
  const parts = normalizeRolandPath(relativePath).split("/").filter(Boolean);
  if (root.name.toUpperCase() === "DATA" && parts[0]?.toUpperCase() === "DATA") {
    parts.shift();
  }
  if (parts.length === 0) throw new Error("Empty path");
  const name = parts[parts.length - 1]!;
  let parent = root as DirWithRemove;
  for (let i = 0; i < parts.length - 1; i++) {
    const found = await findChildDirectory(parent, parts[i]!, createParents);
    parent = found.dir;
  }
  return { parent, name };
}

/** Check that WAVE/ is reachable from this folder handle. */
export async function probeWaveAccess(root: DirectoryHandleLike): Promise<WaveAccessProbe> {
  const rootName = root.name;
  if (rootName.toUpperCase() === "DATA") {
    return {
      rootName,
      waveOk: false,
      waveDirName: null,
      message:
        "This handle is the DATA folder. Open the parent ROLAND folder (the one that contains both DATA and WAVE) to play or import track audio.",
    };
  }
  try {
    const found = await findChildDirectory(root, "WAVE", false);
    return { rootName, waveOk: true, waveDirName: found.name, message: null };
  } catch {
    return {
      rootName,
      waveOk: false,
      waveDirName: null,
      message: `Cannot open WAVE/ under “${rootName}”. Re-open the ROLAND folder that contains both DATA and WAVE.`,
    };
  }
}

async function fileFromChild(
  parent: DirWithRemove,
  name: string,
  handle?: FileSystemHandle,
): Promise<File | null> {
  try {
    if (handle && isFileHandle(handle)) {
      return await (handle as unknown as WritableFileHandle).getFile();
    }
  } catch {
    /* fall through */
  }
  try {
    const fh = await parent.getFileHandle(name);
    return await fh.getFile();
  } catch {
    return null;
  }
}

/** Open the track directory handle WAVE/{NNN}_{T}/ if it exists. */
export async function getTrackDirectoryHandle(
  root: DirectoryHandleLike,
  slot: number,
  track: number,
): Promise<DirWithRemove | null> {
  const probe = await probeWaveAccess(root);
  if (!probe.waveOk) return null;
  const waveDirName = probe.waveDirName ?? "WAVE";
  try {
    const { dir } = await resolveDir(root, waveTrackDir(slot, track, waveDirName), false);
    return dir;
  } catch {
    return null;
  }
}

/** List the first .WAV in a track folder (imported songs may keep an 8.3 name). */
export async function listTrackWav(
  root: DirectoryHandleLike,
  slot: number,
  track: number,
  waveDirName = "WAVE",
): Promise<TrackWavInfo | null> {
  const dirPath = waveTrackDir(slot, track, waveDirName);
  const canonical = waveTrackFileName(slot, track);

  let parent: DirWithRemove;
  try {
    ({ dir: parent } = await resolveDir(root, dirPath, false));
  } catch {
    return null;
  }

  const tryName = async (fileName: string): Promise<TrackWavInfo | null> => {
    const file = await fileFromChild(parent, fileName);
    if (!file) return null;
    return { path: `${dirPath}/${fileName}`, fileName, size: file.size };
  };

  // 1) Canonical pedal name {NNN}_{T}.WAV
  {
    const hit = await tryName(canonical);
    if (hit && hit.size > 0) return hit;
  }

  // 2) Name remembered from a previous successful locate/play/import
  const remembered = rememberedWavFileName(slot, track);
  if (remembered) {
    const hit = await tryName(remembered);
    if (hit) return hit;
  }

  // 3) Enumerate directory (entries/values/keys) — finds AFTERL~1.WAV etc.
  const wavs = await listWavChildren(parent);
  if (wavs[0]) {
    rememberWavFileName(slot, track, wavs[0].name);
    return {
      path: `${dirPath}/${wavs[0].name}`,
      fileName: wavs[0].name,
      size: wavs[0].file.size,
    };
  }

  // 4) Canonical empty stub still counts as present
  {
    const hit = await tryName(canonical);
    if (hit) return hit;
  }

  return null;
}

export async function listMemoryTrackWavs(
  root: DirectoryHandleLike,
  slot: number,
): Promise<{ files: Array<TrackWavInfo | null>; probe: WaveAccessProbe }> {
  const probe = await probeWaveAccess(root);
  const waveDirName = probe.waveDirName ?? "WAVE";
  const files: Array<TrackWavInfo | null> = [];
  for (let t = 1; t <= 6; t++) {
    files.push(probe.waveOk ? await listTrackWav(root, slot, t, waveDirName) : null);
  }
  return { files, probe };
}

export async function readTrackWav(
  root: DirectoryHandleLike,
  slot: number,
  track: number,
): Promise<{ info: TrackWavInfo; bytes: Uint8Array } | null> {
  const probe = await probeWaveAccess(root);
  if (!probe.waveOk) return null;
  const waveDirName = probe.waveDirName ?? "WAVE";
  const info = await listTrackWav(root, slot, track, waveDirName);
  if (!info) return null;
  const { parent, name } = await getParentAndName(root, info.path, false);
  const fh = await parent.getFileHandle(name);
  const file = await fh.getFile();
  const buf = new Uint8Array(await file.arrayBuffer());
  return { info: { ...info, size: buf.byteLength }, bytes: buf };
}

/** Delete every .WAV in the track folder, then write the canonical {NNN}_{T}.WAV. */
export async function writeTrackWav(
  root: DirectoryHandleLike,
  slot: number,
  track: number,
  bytes: Uint8Array,
): Promise<TrackWavInfo> {
  const probe = await probeWaveAccess(root);
  if (!probe.waveOk) {
    throw new Error(probe.message ?? "WAVE/ is not accessible from this folder handle.");
  }
  const waveDirName = probe.waveDirName ?? "WAVE";
  await clearTrackWav(root, slot, track, { removeDir: false, waveDirName });
  const path = waveTrackPath(slot, track, waveDirName);
  const { parent, name } = await getParentAndName(root, path, true);
  const fh = await parent.getFileHandle(name, { create: true });
  const w = await fh.createWritable({ keepExistingData: false });
  if (typeof w.truncate === "function") await w.truncate(0);
  await w.write(bytes);
  await w.close();
  rememberWavFileName(slot, track, name);
  return { path, fileName: name, size: bytes.byteLength };
}

/** Remove all .WAV files in the track directory (and optionally the directory). */
export async function clearTrackWav(
  root: DirectoryHandleLike,
  slot: number,
  track: number,
  opts?: { removeDir?: boolean; waveDirName?: string },
): Promise<void> {
  const waveDirName = opts?.waveDirName ?? (await probeWaveAccess(root)).waveDirName ?? "WAVE";
  const dirPath = waveTrackDir(slot, track, waveDirName);
  let dir: DirWithRemove;
  try {
    ({ dir } = await resolveDir(root, dirPath, false));
  } catch {
    return;
  }

  const toRemove: string[] = [];
  try {
    for await (const [name, handle] of dir.entries()) {
      if (!/\.WAV$/i.test(name)) continue;
      if (handle.kind === "directory") continue;
      toRemove.push(name);
    }
  } catch {
    // Fall back to canonical name only
    toRemove.push(waveTrackFileName(slot, track));
  }
  for (const name of toRemove) {
    if (typeof dir.removeEntry === "function") {
      try {
        await dir.removeEntry(name);
      } catch {
        /* missing */
      }
    }
  }

  if (opts?.removeDir) {
    try {
      const wave = (await findChildDirectory(root, waveDirName, false)).dir;
      const folderName = `${padSlot(slot)}_${track}`;
      if (typeof wave.removeEntry === "function") {
        await wave.removeEntry(folderName, { recursive: true });
      }
    } catch {
      /* keep empty dir — pedal does the same */
    }
  }
}

/** Copy all WAV files from one memory track folder to another (overwrite). */
export async function copyTrackWavFolder(
  root: DirectoryHandleLike,
  sourceSlot: number,
  targetSlot: number,
  track: number,
): Promise<void> {
  const probe = await probeWaveAccess(root);
  if (!probe.waveOk) return;
  const waveDirName = probe.waveDirName ?? "WAVE";
  await clearTrackWav(root, targetSlot, track, { removeDir: false, waveDirName });
  const srcDirPath = waveTrackDir(sourceSlot, track, waveDirName);
  let srcDir: DirWithRemove;
  try {
    ({ dir: srcDir } = await resolveDir(root, srcDirPath, false));
  } catch {
    return;
  }

  const files: { name: string; bytes: Uint8Array }[] = [];
  try {
    for await (const [name, handle] of srcDir.entries()) {
      if (!/\.WAV$/i.test(name)) continue;
      if (handle.kind === "directory") continue;
      const file = await fileFromChild(srcDir, name, handle);
      if (!file) continue;
      files.push({ name, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
  } catch {
    const canonical = waveTrackFileName(sourceSlot, track);
    const file = await fileFromChild(srcDir, canonical);
    if (file) files.push({ name: canonical, bytes: new Uint8Array(await file.arrayBuffer()) });
  }
  if (files.length === 0) return;

  const dstDirPath = waveTrackDir(targetSlot, track, waveDirName);
  const { dir: dstDir } = await resolveDir(root, dstDirPath, true);
  for (const f of files) {
    const canonical = waveTrackFileName(sourceSlot, track);
    const outName =
      f.name.toUpperCase() === canonical.toUpperCase()
        ? waveTrackFileName(targetSlot, track)
        : f.name;
    const fh = await dstDir.getFileHandle(outName, { create: true });
    const w = await fh.createWritable({ keepExistingData: false });
    if (typeof w.truncate === "function") await w.truncate(0);
    await w.write(f.bytes);
    await w.close();
  }
}

export async function copyMemoryWavFolders(
  root: DirectoryHandleLike,
  sourceSlot: number,
  targetSlot: number,
): Promise<void> {
  for (let t = 1; t <= 6; t++) {
    await copyTrackWavFolder(root, sourceSlot, targetSlot, t);
  }
}
