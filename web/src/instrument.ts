import * as Sentry from "@sentry/react";

/** Production Vite builds only — local `npm run ui` never sends events even if VITE_SENTRY_DSN is set. */
const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
if (dsn && import.meta.env.PROD) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.feedbackIntegration({
        autoInject: false,
        colorScheme: "dark",
        showBranding: false,
        enableScreenshot: true,
        formTitle: "Feedback",
        triggerLabel: "Feedback",
        submitButtonLabel: "Send",
        messagePlaceholder: "What went wrong, or what would you like to see?",
        successMessageText: "Thanks — we got your feedback.",
        themeDark: {
          background: "#1a1d24",
          foreground: "#e8eaef",
          accentBackground: "#00c7fd",
          accentForeground: "#0a0c10",
        },
      }),
    ],
    tracesSampleRate: 0.1,
    tracePropagationTargets: [/^\//, /^https:\/\/rc\.test/, /\/api/],
  });
}

export { Sentry };
