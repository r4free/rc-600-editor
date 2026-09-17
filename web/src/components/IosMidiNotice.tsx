import { useState } from "react";
import { IOS_WEB_MIDI_BROWSER_URL } from "@rc600/midi/rc600-midi";
import { Icon } from "./Icon";

const DISMISS_KEY = "rc600-ios-midi-notice-dismissed";

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDismiss(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Page banner when Safari/Chrome on iOS lack Web MIDI. */
export function IosMidiNotice() {
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (dismissed) return null;

  return (
    <div className="warn-banner ios-midi-notice" role="status">
      <div className="ios-midi-notice-body">
        <Icon name="alert" size={14} />
        <p>
          This browser cannot talk to the RC-600 over MIDI. Safari and Chrome on iPhone/iPad have no
          Web MIDI. Open this site in{" "}
          <strong>Web MIDI Browser</strong>, or use a computer (Chrome/Edge).
        </p>
      </div>
      <div className="ios-midi-notice-actions">
        <a
          className="btn primary"
          href={IOS_WEB_MIDI_BROWSER_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Web MIDI Browser
        </a>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            persistDismiss();
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
