import { useState, type FormEvent } from "react";
import { STRIPE_PAYMENT_LINK } from "@rc600/buy-link";
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
    <main className="unlock-screen">
      <section className="unlock-intro" aria-labelledby="unlock-title">
        <p className="unlock-eyebrow">BOSS RC-600 · WEB EDITOR</p>
        <h1 id="unlock-title">Your RC-600, easier to organize.</h1>
        <p className="unlock-lead">
          Edit memories, system settings, and performance tools from one focused workspace in your
          browser.
        </p>
        <div className="unlock-features">
          <div className="unlock-feature">
            <Icon name="loop" size={22} />
            <div>
              <h2>Shape every memory</h2>
              <p>Adjust loop tracks, effects, routing, assignments, and more with readable controls.</p>
            </div>
          </div>
          <div className="unlock-feature">
            <Icon name="usb" size={22} />
            <div>
              <h2>Work your way</h2>
              <p>Open an RC-600 backup or connect with Web MIDI in a compatible browser.</p>
            </div>
          </div>
          <div className="unlock-feature">
            <Icon name="scene" size={22} />
            <div>
              <h2>Get ready to play</h2>
              <p>Build setlists and use live charts, tuner, and rhythm tools in the same editor.</p>
            </div>
          </div>
        </div>
        <a className="unlock-guide" href="./guia.html" target="_blank" rel="noopener noreferrer">
          Explore the user guide
          <Icon name="external" size={15} />
        </a>
      </section>

      <section className="unlock-card" aria-labelledby="activation-title">
        <p className="unlock-card-kicker">Already have a license?</p>
        <h2 id="activation-title">Welcome back</h2>
        <p className="unlock-card-copy">Enter the key from your purchase email to open the editor.</p>
        <form className="unlock-form" onSubmit={(e) => void submit(e)}>
          <label htmlFor="license-key">License key</label>
          <input
            id="license-key"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="RC600-XXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={busy}
            aria-describedby={error ? "license-error" : undefined}
            autoFocus
          />
          {error ? (
            <p className="unlock-error" id="license-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn primary unlock-submit" disabled={busy || !key.trim()}>
            <Icon name="connect" size={16} />
            {busy ? "Checking…" : "Open editor"}
          </button>
        </form>
        <div className="unlock-divider">
          <span>New to the editor?</span>
        </div>
        <a className="unlock-buy" href={STRIPE_PAYMENT_LINK}>
          Get a license
          <Icon name="external" size={15} />
        </a>
        <p className="unlock-purchase-note">
          Secure checkout. Your license key is sent by email after payment.
        </p>
      </section>
    </main>
  );
}
