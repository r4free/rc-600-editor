import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/react";
import { Icon } from "./Icon";

/** Top-bar control that opens Sentry User Feedback. Hidden when DSN is unset. */
export function SentryFeedbackButton() {
  const [available, setAvailable] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    setAvailable(Boolean(Sentry.getFeedback()));
  }, []);

  const onClick = useCallback(async () => {
    if (busy.current) return;
    const feedback = Sentry.getFeedback();
    if (!feedback) return;
    busy.current = true;
    try {
      const form = await feedback.createForm();
      form.appendToDom();
      form.open();
    } finally {
      busy.current = false;
    }
  }, []);

  if (!available) return null;

  return (
    <button
      type="button"
      className="btn"
      title="Report a bug or send feedback"
      aria-label="Feedback"
      onClick={() => void onClick()}
    >
      <Icon name="alert" size={14} /> Feedback
    </button>
  );
}
