import type { AssembleRequest, AssembleResponse } from "@rc600/rc0/ops";

const viteEnv =
  typeof import.meta !== "undefined"
    ? (
        import.meta as {
          env?: {
            VITE_GM_EDITOR_URL?: string;
            VITE_VG_EDITOR_URL?: string;
            VITE_RC_EDITOR_URL?: string;
            PROD?: boolean;
          };
        }
      ).env
    : undefined;

function editorUrl(override: string | undefined, prodUrl: string, localUrl: string): string {
  return override || (viteEnv?.PROD ? prodUrl : localUrl);
}

/** Local Herd alias; production Render URL unless `VITE_GM_EDITOR_URL` overrides. */
export const GM_EDITOR_URL = editorUrl(
  viteEnv?.VITE_GM_EDITOR_URL,
  "https://gm-800-editor.onrender.com",
  "https://gm.test",
);

/** Local Herd alias; production Render URL unless `VITE_VG_EDITOR_URL` overrides. */
export const VG_EDITOR_URL = editorUrl(
  viteEnv?.VITE_VG_EDITOR_URL,
  "https://vg-800-editor.onrender.com",
  "https://vg.test",
);

/** Local Herd alias; production Render URL unless `VITE_RC_EDITOR_URL` overrides. */
export const RC_EDITOR_URL = editorUrl(
  viteEnv?.VITE_RC_EDITOR_URL,
  "https://rc-600-editor.onrender.com",
  "https://rc.test",
);

export type LicenseInfo = {
  id: string;
  expiresAt: string;
  note?: string;
};

export type SessionInfo = {
  ok: boolean;
  mode: "open" | "license";
  requireLicense: boolean;
  license: LicenseInfo | null;
};

export async function fetchSession(): Promise<SessionInfo> {
  try {
    const res = await fetch("/api/session", { credentials: "include" });
    if (!res.ok) {
      // Prefer staying open so a downed API does not trap users on a license screen.
      return { ok: true, mode: "open", requireLicense: false, license: null };
    }
    const data = (await res.json()) as Partial<SessionInfo> & { ok?: boolean };
    // Public mode (default): never block the editor on a stale unlock cookie / old API shape.
    if (data.requireLicense !== true) {
      return {
        ok: true,
        mode: "open",
        requireLicense: false,
        license: data.license ?? null,
      };
    }
    return {
      ok: Boolean(data.ok),
      mode: "license",
      requireLicense: true,
      license: data.license ?? null,
    };
  } catch {
    return { ok: true, mode: "open", requireLicense: false, license: null };
  }
}

export async function activateLicense(
  key: string,
): Promise<{ ok: boolean; session?: SessionInfo; error?: string }> {
  try {
    const res = await fetch("/api/license", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = (await res.json().catch(() => ({}))) as SessionInfo & { error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error || "License activation failed" };
    }
    return { ok: true, session: data };
  } catch {
    return { ok: false, error: "Cannot reach the server. Is the API running?" };
  }
}

export async function lockSession(): Promise<SessionInfo | null> {
  try {
    const res = await fetch("/api/lock", { method: "POST", credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as SessionInfo;
  } catch {
    return null;
  }
}

export type UsbStatus = { eject: boolean };

export async function fetchUsbStatus(): Promise<UsbStatus> {
  try {
    const res = await fetch("/api/usb", { credentials: "include" });
    if (!res.ok) return { eject: false };
    const data = (await res.json()) as { eject?: boolean };
    return { eject: data.eject === true };
  } catch {
    return { eject: false };
  }
}

export async function ejectUsbStorage(): Promise<{
  ok: boolean;
  ejected?: string[];
  message: string;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch("/api/usb/eject", {
      method: "POST",
      credentials: "include",
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      ejected?: string[];
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, message: data.error || data.message || "Eject failed" };
    }
    return {
      ok: data.ok !== false,
      ejected: data.ejected,
      message: data.message || "USB ejected.",
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        ok: false,
        message:
          "Eject is taking too long. Eject BOSS RC-600 from File Explorer, wait for DISCONNECTING…, then power off.",
      };
    }
    return {
      ok: false,
      message: "Cannot reach the eject API. Eject BOSS RC-600 from File Explorer, then power off.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export type ServerWaveTrackInfo = {
  track: number;
  fileName: string;
  size: number;
};

/** List WAVE files for a memory via the local API (Node reads the USB drive). */
export async function fetchMemoryWaveFiles(
  slot: number,
): Promise<Array<ServerWaveTrackInfo | null> | null> {
  try {
    const res = await fetch(`/api/wave/${slot}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tracks?: Array<{ track: number; fileName: string; size: number } | null>;
    };
    if (!Array.isArray(data.tracks) || data.tracks.length !== 6) return null;
    return data.tracks.map((t) =>
      t ? { track: t.track, fileName: t.fileName, size: t.size } : null,
    );
  } catch {
    return null;
  }
}

/** Download one track WAV via the local API. */
export async function fetchTrackWaveFile(
  slot: number,
  track: number,
): Promise<{ fileName: string; bytes: Uint8Array } | null> {
  try {
    const res = await fetch(`/api/wave/${slot}/${track}/file`, { credentials: "include" });
    if (!res.ok) return null;
    const fileName =
      res.headers.get("X-Wave-File-Name") ||
      `MEMORY${String(slot).padStart(3, "0")}_${track}.WAV`;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;
    return { fileName, bytes: buf };
  } catch {
    return null;
  }
}

export async function assembleRemote(req: AssembleRequest): Promise<AssembleResponse> {
  let res: Response;
  try {
    res = await fetch("/api/assemble", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    throw new Error(
      "Cannot reach /api/assemble. On Render the Start Command must be `npm start` (API + dist/web). In local dev run `npm run dev` so Vite proxies /api.",
    );
  }
  if (res.status === 401) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      data.error || "License required or expired — enter a valid license key to save.",
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Assemble API returned ${res.status} (not JSON). The server is probably only serving the static site — check that npm start is running server/index.ts.`,
    );
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Assemble failed (${res.status})`);
  }
  return (await res.json()) as AssembleResponse;
}
