import { useState, type FormEvent } from "react";
import { activateLicense, type SessionInfo } from "../api";
import { Icon } from "./Icon";

export function LicenseScreen({ onActivated }: { onActivated: (session: SessionInfo) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    onActivated(result.session);
  }

  return (
    <div className="empty-state editor-panel unlock-panel">
      <h2>Enter license key</h2>
      <p>
        This build requires a license to save memories and system settings. Editing on screen still
        works without one.
      </p>
      <form className="unlock-form" onSubmit={(e) => void submit(e)}>
        <label className="param-label" htmlFor="license-key">
          License key
        </label>
        <input
          id="license-key"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="RC600-XXXX-XXXX-XXXX"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={busy}
        />
        {error ? <p className="unlock-error">{error}</p> : null}
        <button type="submit" className="btn primary" disabled={busy || !key.trim()}>
          <Icon name="connect" size={14} />
          {busy ? "Checking…" : "Activate"}
        </button>
      </form>
    </div>
  );
}
