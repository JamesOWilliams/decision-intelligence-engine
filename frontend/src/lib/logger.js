/**
 * Production-aware logger.
 * In production builds, error/warn are silenced to keep the console clean.
 * Use this instead of bare `console.*` calls in catch blocks and effects.
 */
const isProd = process.env.NODE_ENV === "production";

export const log = {
  error: (...args) => {
    if (!isProd) console.error(...args);
  },
  warn: (...args) => {
    if (!isProd) console.warn(...args);
  },
  info: (...args) => {
    if (!isProd) console.info(...args);
  },
};
