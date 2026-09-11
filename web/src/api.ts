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
    return (await res.json()) as SessionInfo;
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

export async function assembleRemote(req: AssembleRequest): Promise<AssembleResponse> {
  const res = await fetch("/api/assemble", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (res.status === 401) {
    throw new Error("License required or expired — enter a valid license key to save.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Assemble failed (${res.status})`);
  }
  return (await res.json()) as AssembleResponse;
}
