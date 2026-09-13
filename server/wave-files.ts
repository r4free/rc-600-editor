import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type WaveFileInfo = {
  slot: number;
  track: number;
  fileName: string;
  size: number;
  /** Absolute path on the local machine (server only). */
  absolutePath: string;
};

function padSlot(slot: number): string {
  return String(slot).padStart(3, "0");
}

export function waveTrackDirName(slot: number, track: number): string {
  return `${padSlot(slot)}_${track}`;
}

/** Windows drives that contain ROLAND/DATA (removable or fixed — some hosts remap USB). */
async function listWindowsRolandRoots(
  run: typeof execFileAsync = execFileAsync,
): Promise<string[]> {
  const ps =
    "$ErrorActionPreference = 'SilentlyContinue'; " +
    "Get-CimInstance -ClassName Win32_LogicalDisk | " +
    "Where-Object { Test-Path -LiteralPath ($_.DeviceID + '\\ROLAND\\DATA') } | " +
    "ForEach-Object { $_.DeviceID + '\\ROLAND' }";
  try {
    const { stdout } = await run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true, timeout: 15000 },
    );
    return String(stdout ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && existsSync(l));
  } catch {
    return [];
  }
}

function listMacRolandRoots(): string[] {
  const volumesDir = "/Volumes";
  if (!existsSync(volumesDir)) return [];
  const found: string[] = [];
  for (const name of readdirSync(volumesDir)) {
    const root = join(volumesDir, name, "ROLAND");
    if (existsSync(join(root, "DATA"))) found.push(root);
  }
  return found;
}

/** Absolute paths to ROLAND folders on connected RC-600 USB volumes. */
export async function findRolandRoots(
  platform: NodeJS.Platform = process.platform,
): Promise<string[]> {
  if (platform === "win32") return listWindowsRolandRoots();
  if (platform === "darwin") return listMacRolandRoots();
  return [];
}

function pickLargestWav(dir: string): { fileName: string; size: number; absolutePath: string } | null {
  if (!existsSync(dir)) return null;
  let best: { fileName: string; size: number; absolutePath: string } | null = null;
  for (const name of readdirSync(dir)) {
    if (!/\.WAV$/i.test(name)) continue;
    const absolutePath = join(dir, name);
    try {
      const st = statSync(absolutePath);
      if (!st.isFile()) continue;
      if (!best || st.size > best.size) {
        best = { fileName: name, size: st.size, absolutePath };
      }
    } catch {
      /* skip */
    }
  }
  return best;
}

/** Find the WAV for one track under any connected ROLAND/WAVE/{NNN}_{T}/. */
export async function findTrackWaveFile(
  slot: number,
  track: number,
  platform: NodeJS.Platform = process.platform,
): Promise<WaveFileInfo | null> {
  if (slot < 1 || slot > 99 || track < 1 || track > 6) return null;
  const roots = await findRolandRoots(platform);
  const folder = waveTrackDirName(slot, track);
  for (const root of roots) {
    const dir = join(root, "WAVE", folder);
    const hit = pickLargestWav(dir);
    if (hit) {
      return { slot, track, fileName: hit.fileName, size: hit.size, absolutePath: hit.absolutePath };
    }
  }
  return null;
}

export async function listMemoryWaveFiles(
  slot: number,
  platform: NodeJS.Platform = process.platform,
): Promise<Array<WaveFileInfo | null>> {
  const out: Array<WaveFileInfo | null> = [];
  for (let t = 1; t <= 6; t++) {
    out.push(await findTrackWaveFile(slot, t, platform));
  }
  return out;
}

export function readWaveFileBytes(absolutePath: string): Uint8Array {
  return new Uint8Array(readFileSync(absolutePath));
}
