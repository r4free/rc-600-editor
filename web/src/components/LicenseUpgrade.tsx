import { useState, type FormEvent } from "react";
import { STRIPE_PAYMENT_LINK } from "@rc600/buy-link";
import { activateLicense, type SessionInfo } from "../api";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

/** Top-bar badge for a trial or preview key; opens a window to enter a full key or buy one. */
export function LicenseUpgrade({
  label,
  hint,
  onActivated,
}: {
  label: string;
  hint: string;
  onActivated: (session: SessionInfo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    if (busy) return;
    setOpen(false);
    setKey("");
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await activateLicense(key);
    setBusy(false);
    if (!result.ok || !result.session) {
      setError(result.error ?? "Activation failed");
      return;
    }
    setOpen(false);
    setKey("");
    onActivated(result.session);
  }

  return (
    <>
      <button type="button" className="btn ghost license-upgrade-badge" title={hint} onClick={() => setOpen(true)}>
        <Icon name="key" size={14} />
        {label}
      </button>
      {open ? (
        <Modal title="Full license" onClose={close} className="license-upgrade-modal">
          <p className="license-upgrade-copy">{hint}</p>
          <form className="unlock-form" onSubmit={(e) => void submit(e)}>
            <label htmlFor="license-upgrade-key">License key</label>
            <input
              id="license-upgrade-key"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="RC600-XXXX-XXXX-XXXX"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={busy}
              aria-describedby={error ? "license-upgrade-error" : undefined}
              autoFocus
            />
            {error ? (
              <p className="unlock-error" id="license-upgrade-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn primary unlock-submit" disabled={busy || !key.trim()}>
              <Icon name="connect" size={16} />
              {busy ? "Checking…" : "Use this key"}
            </button>
          </form>
          <div className="unlock-divider">
            <span>No full license yet?</span>
          </div>
          <a className="unlock-buy" href={STRIPE_PAYMENT_LINK} target="_blank" rel="noopener noreferrer">
            Get a license
            <Icon name="external" size={15} />
          </a>
          <p className="unlock-purchase-note">Secure checkout. Your license key is sent by email after payment.</p>
        </Modal>
      ) : null}
    </>
  );
}
