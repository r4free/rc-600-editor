import { useState } from "react";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import {
  GITHUB_SPONSORS_URL,
  SUPPORT_FEATURES,
  supportNoticeTitle,
  takeSupportNoticeKind,
} from "../support/notice";

export function SupportNoticeModal() {
  const [kind] = useState(() => takeSupportNoticeKind());
  const [open, setOpen] = useState(true);

  if (!open) return null;

  const returning = kind === "returning";

  return (
    <Modal
      title={supportNoticeTitle(kind)}
      className="support-notice-modal"
      onClose={() => setOpen(false)}
      foot={
        <>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            Continue
          </button>
          <a
            className="btn primary"
            href={GITHUB_SPONSORS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="heart" size={14} />
            Support on GitHub Sponsors
          </a>
        </>
      }
    >
      {returning ? (
        <p className="support-notice-kicker">Help keep the RC-600 Web Editor alive!</p>
      ) : null}
      <p>
        Hey there! I&apos;m the solo developer behind this editor.
      </p>
      <p>
        I&apos;ve built and released all these features — completely for free — to help the looper
        community and make our live gigs easier:
      </p>
      <ul className="support-notice-features">
        {SUPPORT_FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <p>
        Building, updating, and hosting this platform takes dozens of hours of personal time and
        ongoing server costs. Right now, very few users have contributed, and the project really
        needs community support to stay active and keep evolving.
      </p>
      <p>
        If this tool saves you time, simplifies your live rig, or helps your workflow, please
        consider supporting its development:
      </p>
      <div className="support-notice-actions">
        <section>
          <h3>Donate via GitHub Sponsors</h3>
          <p>Every single dollar helps keep the project running and new features coming.</p>
        </section>
        <section>
          <h3>Share it</h3>
          <p>Spread the word in forums, Facebook groups, or with fellow musicians!</p>
        </section>
      </div>
      <p className="support-notice-thanks">
        Thank you so much for being here and for helping keep this tool free for everyone!
      </p>
    </Modal>
  );
}
