import { useId, useState } from "react";
import type { ClientEntitlements, LicenseDeviceInfo } from "../entitlements";
import { GITHUB_SPONSORS_URL } from "../support/notice";

export type UnlockSubmitResult =
  | { ok: true; entitlements?: ClientEntitlements }
  | {
      ok: false;
      reason: "invalid_key" | "device_limit" | "other";
      message: string;
      devices?: LicenseDeviceInfo[];
      entitlements?: ClientEntitlements;
    };

function formatSeen(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  try {
    return new Date(t).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function FullPlanUnlock({
  unlocked,
  onSubmitKey,
  onRevokeDevice,
  onForgetThisDevice,
  onClearKeyFromBrowser,
  hasStoredKey,
  devices = [],
  maxDevices = 3,
}: {
  unlocked: boolean;
  onSubmitKey: (key: string) => void | Promise<UnlockSubmitResult | void>;
  onRevokeDevice?: (deviceId: string) => void | Promise<UnlockSubmitResult | void>;
  /** Unbind this browser + clear local key. */
  onForgetThisDevice?: () => void | Promise<void>;
  /** Clear key locally without freeing the seat. */
  onClearKeyFromBrowser?: () => void | Promise<void>;
  hasStoredKey?: boolean;
  devices?: LicenseDeviceInfo[];
  maxDevices?: number;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [seatDevices, setSeatDevices] = useState<LicenseDeviceInfo[]>([]);
  const [showSeats, setShowSeats] = useState(false);
  const titleId = useId();
  const inputId = useId();

  if (unlocked && !hasStoredKey) return null;

  const listed = showSeats || (unlocked && open) ? (seatDevices.length ? seatDevices : devices) : seatDevices;
  const managing = unlocked && hasStoredKey;

  function resetModal() {
    setDraft("");
    setErr("");
    setSeatDevices([]);
    setShowSeats(false);
  }

  function close() {
    setOpen(false);
    resetModal();
  }

  async function submit(keyOverride?: string) {
    setBusy(true);
    setErr("");
    try {
      const result = await onSubmitKey(keyOverride ?? draft);
      if (!result || result.ok) {
        close();
        return;
      }
      if (result.reason === "device_limit") {
        setShowSeats(true);
        setSeatDevices(result.devices ?? result.entitlements?.devices ?? []);
        setErr(result.message);
        return;
      }
      setErr(result.message);
      if (result.devices?.length) {
        setShowSeats(true);
        setSeatDevices(result.devices);
      }
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function openAndRecheck() {
    resetModal();
    setOpen(true);
    if (hasStoredKey && !unlocked) {
      await submit("");
    }
  }

  async function revoke(deviceId: string) {
    if (!onRevokeDevice) return;
    setBusy(true);
    setErr("");
    try {
      const result = await onRevokeDevice(deviceId);
      if (result && !result.ok && result.reason === "device_limit") {
        setShowSeats(true);
        setSeatDevices(result.devices ?? result.entitlements?.devices ?? []);
        setErr(result.message);
        return;
      }
      if (result && !result.ok) {
        setErr(result.message);
        if (result.devices) setSeatDevices(result.devices);
        return;
      }
      if (managing) {
        if (result?.ok && result.entitlements) {
          setSeatDevices(result.entitlements.devices);
        } else {
          setSeatDevices((prev) => prev.filter((d) => d.id !== deviceId));
        }
        return;
      }
      const again = await onSubmitKey(draft.trim());
      if (!again || again.ok) {
        close();
        return;
      }
      if (again.reason === "device_limit") {
        setShowSeats(true);
        setSeatDevices(again.devices ?? again.entitlements?.devices ?? []);
        setErr(again.message);
        return;
      }
      setErr(again.message);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    setBusy(true);
    setErr("");
    try {
      await onForgetThisDevice?.();
      close();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function clearLocal() {
    setBusy(true);
    setErr("");
    try {
      await onClearKeyFromBrowser?.();
      close();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  function openManage() {
    resetModal();
    setShowSeats(true);
    setSeatDevices(devices);
    setOpen(true);
  }

  return (
    <div className="full-plan-unlock">
      {managing ? (
        <button
          type="button"
          className="full-plan-unlock-btn on"
          title="Full plan — manage devices"
          onClick={openManage}
        >
          Full plan
        </button>
      ) : (
        <button
          type="button"
          className="full-plan-unlock-btn"
          title="Unlock Setlists with a Full plan key"
          onClick={() => void openAndRecheck()}
        >
          Unlock Full
        </button>
      )}
      {open ? (
        <div className="full-plan-modal-backdrop" role="presentation" onClick={close}>
          <div
            className="full-plan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId}>{managing ? "Full plan devices" : "Full plan access"}</h2>
            <p>
              {managing
                ? `This access key can be used on up to ${maxDevices} browsers (devices). Removing a device frees a seat.`
                : `Setlists, live charts, and score guides are part of the Full plan. Each key works on up to ${maxDevices} browsers. Enter your access key, or `}
              {!managing ? (
                <a href={GITHUB_SPONSORS_URL} target="_blank" rel="noreferrer">
                  support via GitHub Sponsors
                </a>
              ) : null}
              {!managing ? "." : null}
            </p>

            {!managing ? (
              <>
                <label className="full-plan-key-label" htmlFor={inputId}>
                  Access key
                </label>
                <input
                  id={inputId}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft}
                  disabled={busy}
                  placeholder="Paste your key"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                  }}
                />
              </>
            ) : null}

            {showSeats || listed.length > 0 ? (
              <div className="full-plan-devices">
                <div className="full-plan-devices-title">
                  Devices ({listed.length}/{maxDevices})
                </div>
                <ul className="full-plan-device-list">
                  {listed.map((d) => (
                    <li key={d.id} className={d.current ? "current" : undefined}>
                      <div className="full-plan-device-meta">
                        <span className="full-plan-device-label">
                          {d.label}
                          {d.current ? " · this browser" : ""}
                        </span>
                        {d.lastSeenAt ? (
                          <span className="full-plan-device-seen">Last seen {formatSeen(d.lastSeenAt)}</span>
                        ) : null}
                      </div>
                      {onRevokeDevice ? (
                        <button
                          type="button"
                          className="btn ghost full-plan-device-remove"
                          disabled={busy}
                          onClick={() => void revoke(d.id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {err ? <p className="full-plan-err">{err}</p> : null}

            <div className="full-plan-actions">
              {managing ? (
                <>
                  <button type="button" className="btn ghost" disabled={busy} onClick={close}>
                    Close
                  </button>
                  {onClearKeyFromBrowser ? (
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void clearLocal()}>
                      Clear key from this browser
                    </button>
                  ) : null}
                  {onForgetThisDevice ? (
                    <button type="button" className="btn" disabled={busy} onClick={() => void forget()}>
                      Forget this device
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <button type="button" className="btn ghost" disabled={busy} onClick={close}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || (!draft.trim() && !hasStoredKey)}
                    onClick={() => void submit()}
                  >
                    Unlock
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
