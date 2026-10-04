import { useState, type FormEvent } from "react";
import { STRIPE_PAYMENT_LINK } from "@rc600/buy-link";
import { IOS_WEB_MIDI_BROWSER_URL } from "@rc600/midi/rc600-midi";
import { activateLicense, type SessionInfo } from "../api";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

const REQUIREMENTS_COPY = `System requirements — RC-600 Web Editor

The editor runs in any modern web browser, on a computer, phone, or tablet.

Live MIDI to the RC-600 needs Web MIDI. Safari and Chrome on iPhone and iPad do not include Web MIDI, so connecting to the pedal over MIDI does not work in those browsers.

On iPhone or iPad, open the site in Web MIDI Browser (App Store: ${IOS_WEB_MIDI_BROWSER_URL}). Live MIDI then works the same way. On a computer, use Chrome or Edge.`;

export function LicenseScreen({ onActivated }: { onActivated: (session: SessionInfo) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);

  async function copyRequirements() {
    try {
      await navigator.clipboard.writeText(REQUIREMENTS_COPY);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
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
    onActivated(result.session);
  }

  return (
    <main className="unlock-screen">
      <section className="unlock-intro" aria-labelledby="unlock-title">
        <img
          className="unlock-pedal"
          src={`${import.meta.env.BASE_URL}rc600-front.png`}
          alt="BOSS RC-600 Loop Station"
          width={581}
          height={215}
        />
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
        <div className="unlock-links">
          <button type="button" className="unlock-guide" onClick={() => setRequirementsOpen(true)}>
            System requirements
          </button>
          <a className="unlock-guide" href="./guia.html" target="_blank" rel="noopener noreferrer">
            Explore the user guide
            <Icon name="external" size={15} />
          </a>
        </div>
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
      {requirementsOpen ? (
        <Modal
          title="System requirements"
          onClose={() => setRequirementsOpen(false)}
          actions={
            <button type="button" className="btn ghost" onClick={() => void copyRequirements()}>
              <Icon name={copied ? "connect" : "copy"} size={14} />
              {copied ? "Copied" : "Copy"}
            </button>
          }
        >
          <ul className="unlock-requirements">
            <li>Runs in any modern browser, on a computer, phone, or tablet.</li>
            <li>
              Live MIDI to the RC-600 needs Web MIDI. Safari and Chrome on iPhone and iPad do not
              include it, so the MIDI connection does not work there.
            </li>
            <li>
              On iPhone or iPad, open this site in{" "}
              <a href={IOS_WEB_MIDI_BROWSER_URL} target="_blank" rel="noopener noreferrer">
                Web MIDI Browser
              </a>{" "}
              and live MIDI works. On a computer, use Chrome or Edge.
            </li>
          </ul>
        </Modal>
      ) : null}
    </main>
  );
}
