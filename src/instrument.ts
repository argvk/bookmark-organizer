import * as Sentry from "@sentry/node";

// Ensure to call this before requiring any other modules!
Sentry.init({
  dsn: "https://1dff7dad628d2634850849cefede66a0@o4509859390947328.ingest.de.sentry.io/4510014394400848",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#tracesSampleRate
  tracesSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  environment: process.env.NODE_ENV || "development",
});