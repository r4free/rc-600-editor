import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { licenseEmailSubject, licenseEmailText } from "./licenseEmail";
import "./dev-license.css";

type ManagedLicense = {
  id: string;
  key?: string;
  name: string;
  email: string;
  location: string;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
  revoked?: boolean;
  plan?: "full" | "preview";
  inPublicFile: boolean;
  inLocalFile: boolean;
};

type Fields = {
  name: string;
  email: string;
  location: string;
  plan: "full" | "preview";
  startsOn: string;
  endsOn: string;
};

const EMPTY_FIELDS: Fields = { name: "", email: "", location: "", plan: "full", startsOn: "", endsOn: "" };

function dayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toISOString();
}

function dayEndIso(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999`).toISOString();
}

function isoToYmd(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const TRIAL_DAYS = [3, 7, 14, 30] as const;

function localYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Starts today and ends at the end of the last day, so "7 days" covers today plus six more. */
function trialWindow(days: number): { startsOn: string; endsOn: string } {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return { startsOn: localYmd(start), endsOn: localYmd(end) };
}

function formatDay(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function validityText(lic: Pick<ManagedLicense, "startsAt" | "expiresAt">): string {
  if (!lic.startsAt && !lic.expiresAt) return "Never expires";
  if (lic.startsAt && lic.expiresAt) return `${formatDay(lic.startsAt)} – ${formatDay(lic.expiresAt)}`;
  if (lic.startsAt) return `From ${formatDay(lic.startsAt)}`;
  return `Until ${formatDay(lic.expiresAt)}`;
}

function licenseState(lic: ManagedLicense): { label: string; tone: "ok" | "wait" | "off" } {
  const now = Date.now();
  if (lic.revoked) return { label: "Revoked", tone: "off" };
  if (lic.expiresAt && Date.parse(lic.expiresAt) < now) return { label: "Expired", tone: "off" };
  if (lic.startsAt && Date.parse(lic.startsAt) > now) return { label: "Not started", tone: "wait" };
  return { label: "Active", tone: "ok" };
}

function fieldsBody(fields: Fields) {
  return {
    name: fields.name,
    email: fields.email,
    location: fields.location,
    plan: fields.plan,
    startsAt: fields.startsOn ? dayStartIso(fields.startsOn) : "",
    expiresAt: fields.endsOn ? dayEndIso(fields.endsOn) : "",
  };
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error ?? fallback);
  return data;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  }
  return { copied, copy };
}

function LicenseFields({ fields, onChange }: { fields: Fields; onChange: (next: Fields) => void }) {
  const set = (patch: Partial<Fields>) => onChange({ ...fields, ...patch });
  return (
    <>
      <div className="dev-license-grid">
        <label>
          Name
          <input value={fields.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" required />
        </label>
        <label>
          Email
          <input
            type="email"
            value={fields.email}
            onChange={(e) => set({ email: e.target.value })}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Location
          <input
            value={fields.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Optional"
            autoComplete="off"
          />
        </label>
        <label>
          Key
          <select value={fields.plan} onChange={(e) => set({ plan: e.target.value === "preview" ? "preview" : "full" })}>
            <option value="full">Full — save everything</option>
            <option value="preview">Preview — play and look, limited save</option>
          </select>
        </label>
        <div className="dev-license-period" role="group" aria-label="Trial period">
          <span>Trial period</span>
          {TRIAL_DAYS.map((days) => {
            const range = trialWindow(days);
            const on = fields.startsOn === range.startsOn && fields.endsOn === range.endsOn;
            return (
              <button
                key={days}
                type="button"
                className={`btn ghost${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => set(range)}
              >
                {days} days
              </button>
            );
          })}
          <button
            type="button"
            className={`btn ghost${!fields.startsOn && !fields.endsOn ? " is-on" : ""}`}
            aria-pressed={!fields.startsOn && !fields.endsOn}
            onClick={() => set({ startsOn: "", endsOn: "" })}
          >
            No end
          </button>
        </div>
        <div className="dev-license-dates">
          <label>
            Starts
            <input type="date" value={fields.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
          </label>
          <label>
            Ends
            <input type="date" value={fields.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />
          </label>
        </div>
      </div>
      <p className="dev-license-hint">
        Leave both dates empty for a key that never expires. A trial period starts today and ends at the end of its
        last day; after that the editor asks for a new key. A preview key can play and look through the editor.
        Setlists and rhythm lists are not saved. Memories save only while the RC-600 is not connected.
      </p>
    </>
  );
}

function EmailPanel({
  license,
}: {
  license: Pick<ManagedLicense, "key" | "name" | "email" | "plan" | "startsAt" | "expiresAt">;
}) {
  const { copied, copy } = useCopy();
  if (!license.key) {
    return (
      <p className="dev-license-hint">
        This key was not issued on this computer, so only its fingerprint is stored. It cannot be emailed again.
      </p>
    );
  }
  const subject = licenseEmailSubject(license.plan);
  const message = licenseEmailText({
    name: license.name,
    key: license.key,
    plan: license.plan,
    startsAt: license.startsAt,
    expiresAt: license.expiresAt,
  });
  const mailto = `mailto:${encodeURIComponent(license.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  return (
    <div className="dev-license-email">
      <p className="dev-license-key">{license.key}</p>
      <div className="dev-license-actions">
        <a className="btn primary" href={mailto} style={{ textDecoration: "none" }} title="Open your email app with the subject and message filled in">
          <Icon name="emailSend" size={14} />
          Send email
        </a>
        <button type="button" className="btn" onClick={() => void copy("key", license.key!)}>
          <Icon name="copy" size={14} />
          {copied === "key" ? "Key copied" : "Copy key"}
        </button>
        <button type="button" className="btn" onClick={() => void copy("subject", subject)}>
          <Icon name="copy" size={14} />
          {copied === "subject" ? "Subject copied" : "Copy subject"}
        </button>
        <button type="button" className="btn" onClick={() => void copy("message", message)}>
          <Icon name="copy" size={14} />
          {copied === "message" ? "Message copied" : "Copy message"}
        </button>
      </div>
      <label>
        To
        <input readOnly value={license.email} />
      </label>
      <label>
        Email subject
        <input readOnly value={subject} />
      </label>
      <label>
        Email message
        <textarea readOnly value={message} rows={14} />
      </label>
    </div>
  );
}

function IssuePanel({ onIssued }: { onIssued: () => void }) {
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<ManagedLicense | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssued(null);
    try {
      const data = await readJson<{ id: string; key: string; plan?: "full" | "preview"; startsAt?: string; expiresAt?: string }>(
        await fetch("/api/dev/licenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fieldsBody(fields)),
        }),
        "Could not create the license",
      );
      setIssued({
        id: data.id,
        key: data.key,
        name: fields.name.trim(),
        email: fields.email.trim().toLowerCase(),
        location: fields.location.trim(),
        plan: data.plan === "preview" ? "preview" : "full",
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        createdAt: new Date().toISOString(),
        inPublicFile: true,
        inLocalFile: true,
      });
      onIssued();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the local API");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dev-license-split">
      <form className="dev-license-form" onSubmit={(e) => void submit(e)}>
        <LicenseFields fields={fields} onChange={setFields} />
        {error ? (
          <p className="dev-license-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dev-license-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            <Icon name="key" size={14} />
            {busy ? "Issuing…" : "Generate key"}
          </button>
          {issued ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setFields(EMPTY_FIELDS);
                setIssued(null);
              }}
            >
              <Icon name="plus" size={14} />
              New key
            </button>
          ) : null}
        </div>
      </form>
      <div className="dev-license-form">
        {issued ? (
          <>
            <p className="dev-license-hint">{issued.expiresAt || issued.startsAt ? validityText(issued) : "This key never expires."}</p>
            <EmailPanel license={issued} />
          </>
        ) : (
          <p className="dev-license-empty">The key and a ready-to-send email appear here after you generate it.</p>
        )}
      </div>
    </div>
  );
}

function KeysPanel({ licenses, loading, error, reload }: {
  licenses: ManagedLicense[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return licenses;
    return licenses.filter((l) =>
      [l.name, l.email, l.location, l.key ?? ""].some((v) => v.toLowerCase().includes(q)),
    );
  }, [licenses, query]);

  const selected = licenses.find((l) => l.id === selectedId) ?? null;

  function select(lic: ManagedLicense) {
    setSelectedId(lic.id);
    setEditing(false);
    setConfirmDelete(false);
    setActionError(null);
  }

  function startEdit(lic: ManagedLicense) {
    setFields({
      name: lic.name,
      email: lic.email,
      location: lic.location,
      plan: lic.plan === "preview" ? "preview" : "full",
      startsOn: isoToYmd(lic.startsAt),
      endsOn: isoToYmd(lic.expiresAt),
    });
    setEditing(true);
    setConfirmDelete(false);
    setActionError(null);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      await readJson(
        await fetch(`/api/dev/licenses/${encodeURIComponent(selected.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fieldsBody(fields)),
        }),
        "Could not update the license",
      );
      setEditing(false);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reach the local API");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      await readJson(
        await fetch(`/api/dev/licenses/${encodeURIComponent(selected.id)}`, { method: "DELETE" }),
        "Could not delete the license",
      );
      setSelectedId(null);
      setConfirmDelete(false);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reach the local API");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dev-license-split">
      <div className="dev-license-list-pane">
        <input
          className="dev-license-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or key"
          aria-label="Search keys"
        />
        {error ? (
          <p className="dev-license-error" role="alert">
            {error}
          </p>
        ) : null}
        {loading && licenses.length === 0 ? <p className="dev-license-empty">Loading…</p> : null}
        {!loading && filtered.length === 0 ? <p className="dev-license-empty">No keys found.</p> : null}
        <ul className="dev-license-list">
          {filtered.map((lic) => {
            const state = licenseState(lic);
            return (
              <li key={lic.id}>
                <button
                  type="button"
                  className={`dev-license-row${lic.id === selectedId ? " is-selected" : ""}`}
                  onClick={() => select(lic)}
                >
                  <span className="dev-license-row-head">
                    <strong>{lic.name || "(no name)"}</strong>
                    {lic.plan === "preview" ? <span className="dev-license-state is-wait">Preview</span> : null}
                    <span className={`dev-license-state is-${state.tone}`}>{state.label}</span>
                  </span>
                  <span className="dev-license-row-sub">{lic.email || "—"}</span>
                  <span className="dev-license-row-sub">
                    <code>{lic.key ?? "key not stored"}</code> · {validityText(lic)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="dev-license-form">
        {!selected ? (
          <p className="dev-license-empty">Pick a key to email it again, edit it or delete it.</p>
        ) : editing ? (
          <form className="dev-license-form" onSubmit={(e) => void saveEdit(e)}>
            <LicenseFields fields={fields} onChange={setFields} />
            <p className="dev-license-hint">
              Saves to both license files and adds a line to the change log. The public site picks up the change after
              data/licenses.json is deployed.
            </p>
            {actionError ? (
              <p className="dev-license-error" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="dev-license-actions">
              <button type="submit" className="btn primary" disabled={busy}>
                <Icon name="save" size={14} />
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="dev-license-detail-head">
              <div>
                <h3>{selected.name || "(no name)"}</h3>
                <p className="dev-license-hint">
                  {[selected.location, validityText(selected), `Created ${formatDay(selected.createdAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                  {selected.updatedAt ? ` · Edited ${formatDay(selected.updatedAt)}` : ""}
                </p>
                {!selected.inPublicFile ? (
                  <p className="dev-license-error">Missing from data/licenses.json, so the site will not accept it.</p>
                ) : null}
              </div>
              <div className="dev-license-actions">
                <button type="button" className="btn" onClick={() => startEdit(selected)}>
                  <Icon name="edit" size={14} />
                  Edit
                </button>
                {confirmDelete ? (
                  <>
                    <button type="button" className="btn danger" onClick={() => void remove()} disabled={busy}>
                      <Icon name="trash" size={14} />
                      {busy ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmDelete(true)}
                    title="Remove this key from both license files. The change log keeps a copy."
                  >
                    <Icon name="trash" size={14} />
                    Delete
                  </button>
                )}
              </div>
            </div>
            {confirmDelete ? (
              <p className="dev-license-error" role="alert">
                The key stops working once data/licenses.json is deployed. A copy stays in the change log.
              </p>
            ) : null}
            {actionError ? (
              <p className="dev-license-error" role="alert">
                {actionError}
              </p>
            ) : null}
            <EmailPanel license={selected} />
          </>
        )}
      </div>
    </div>
  );
}

export default function DevLicenseButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"issue" | "keys">("issue");
  const [licenses, setLicenses] = useState<ManagedLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setListError(null);
    try {
      const data = await readJson<{ licenses: ManagedLicense[] }>(
        await fetch("/api/dev/licenses"),
        "Could not load the keys",
      );
      setLicenses(data.licenses);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not reach the local API");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void reload();
  }, [open]);

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
        <Modal title="License keys" onClose={() => setOpen(false)} wide className="dev-license-modal">
          <div className="tabs tabs-sub" role="tablist" aria-label="License keys">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "issue"}
              className={`tab ${tab === "issue" ? "active" : ""}`}
              onClick={() => setTab("issue")}
            >
              <Icon name="plus" size={14} />
              Issue
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "keys"}
              className={`tab ${tab === "keys" ? "active" : ""}`}
              onClick={() => setTab("keys")}
            >
              <Icon name="key" size={14} />
              Keys ({licenses.length})
            </button>
          </div>
          {tab === "issue" ? (
            <IssuePanel onIssued={() => void reload()} />
          ) : (
            <KeysPanel licenses={licenses} loading={loading} error={listError} reload={() => void reload()} />
          )}
        </Modal>
      ) : null}
    </>
  );
}
