import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync } from "node:fs";

const execFileAsync = promisify(execFile);

const WIN_EJECT_PS = [
  "$ErrorActionPreference = 'Stop'",
  "$drives = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=2' |",
  "  Where-Object { Test-Path -LiteralPath ($_.DeviceID + '\\ROLAND\\DATA') })",
  "if ($drives.Count -eq 0) { Write-Output 'NONE'; exit 0 }",
  "$shell = New-Object -ComObject Shell.Application",
  "$computer = $shell.NameSpace(17)",
  "foreach ($d in $drives) {",
  "  $item = $computer.ParseName($d.DeviceID)",
  "  if ($item) { $item.InvokeVerb('Eject') }",
  "  Write-Output $d.DeviceID",
  "}",
].join("; ");

export function isLocalUsbHost(
  hostHeader: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.RENDER) return false;
  if (env.RC600_DISABLE_USB_EJECT === "1") return false;
  const host = (hostHeader ?? "").split(":")[0]?.toLowerCase() ?? "";
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "rc.test";
}

export function parseEjectStdout(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "NONE");
}

export function listMacRolandVolumes(
  volumesDir = "/Volumes",
  exists: (path: string) => boolean = existsSync,
  listDir: (path: string) => string[] = (p) => readdirSync(p),
): string[] {
  if (!exists(volumesDir)) return [];
  const found: string[] = [];
  for (const name of listDir(volumesDir)) {
    const root = `${volumesDir}/${name}`;
    if (exists(`${root}/ROLAND/DATA`)) found.push(root);
  }
  return found;
}

export async function ejectRc600Usb(
  platform: NodeJS.Platform = process.platform,
  run: typeof execFileAsync = execFileAsync,
): Promise<{ ok: boolean; ejected: string[]; message: string }> {
  if (platform === "win32") {
    const { stdout } = await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      WIN_EJECT_PS,
    ]);
    const ejected = parseEjectStdout(String(stdout ?? ""));
    if (ejected.length === 0) {
      return {
        ok: false,
        ejected,
        message:
          "No removable BOSS RC-600 drive found. Eject BOSS RC-600 from File Explorer, wait for DISCONNECTING…, then power off.",
      };
    }
    return {
      ok: true,
      ejected,
      message: `Ejected ${ejected.join(", ")}. Wait for DISCONNECTING… on the RC-600, then power off.`,
    };
  }

  if (platform === "darwin") {
    const volumes = listMacRolandVolumes();
    if (volumes.length === 0) {
      return {
        ok: false,
        ejected: [],
        message:
          "No BOSS RC-600 volume found. Eject the drive in Finder, wait for DISCONNECTING…, then power off.",
      };
    }
    const ejected: string[] = [];
    for (const vol of volumes) {
      await run("diskutil", ["eject", vol]);
      ejected.push(vol);
    }
    return {
      ok: true,
      ejected,
      message: `Ejected ${ejected.join(", ")}. Wait for DISCONNECTING… on the RC-600, then power off.`,
    };
  }

  return {
    ok: false,
    ejected: [],
    message: "USB eject from this editor is Windows/macOS only. Eject BOSS RC-600 from the OS, then power off.",
  };
}
