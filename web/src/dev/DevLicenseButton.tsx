import { useState, type FormEvent } from "react";
import { Modal } from "../components/Modal";
import "./dev-license.css";

type IssuedKey = {
  key: string;
  note: string;
  startsAt?: string;
  expiresAt?: string;
};

function dayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toISOString();
}

function dayEndIso(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999`).toISOString();
}

function formatWhen(iso: string | undefined, empty: string): string {
  if (!iso) return empty;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return empty;
  return date.toLocaleString();
}

export default function DevLicenseButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [copied, setCopied] = useState(false);

  function close() {
    setOpen(false);
    setError(null);
    setCopied(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssued(null);
    setCopied(false);
    try {
      const response = await fetch("/api/dev/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          location,
          startsAt: startsOn ? dayStartIso(startsOn) : "",
          expiresAt: endsOn ? dayEndIso(endsOn) : "",
        }),
      });
      const data = (await response.json()) as { error?: string } & Partial<IssuedKey>;
      if (!response.ok || !data.key) {
        setError(data.error ?? "Could not create the license");
        return;
      }
      setIssued({
        key: data.key,
        note: data.note ?? "",
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
      });
    } catch {
      setError("Could not reach the local API");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen(true)}
        title="Local development only. This control is not in the production site."
      >
        Issue key
      </button>
      {open ? (
        <Modal title="Issue license key" onClose={close}>
          <form className="dev-license-form" onSubmit={(e) => void submit(e)}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Location
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional"
                autoComplete="off"
              />
            </label>
            <div className="dev-license-dates">
              <label>
                Starts
                <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </label>
              <label>
                Ends
                <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </label>
            </div>
            <p className="dev-license-hint">Leave both dates empty for a key that never expires.</p>
            {error ? (
              <p className="dev-license-error" role="alert">
                {error}
              </p>
            ) : null}
            {issued ? (
              <div className="dev-license-result">
                <p className="dev-license-key">{issued.key}</p>
                <p>
                  {issued.startsAt || issued.expiresAt
                    ? `Valid from ${formatWhen(issued.startsAt, "now")} until ${formatWhen(issued.expiresAt, "never")}.`
                    : "This key never expires."}
                </p>
                <button type="button" className="btn" onClick={() => void copyKey()}>
                  {copied ? "Copied" : "Copy key"}
                </button>
              </div>
            ) : null}
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? "Issuing…" : "Generate key"}
            </button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
