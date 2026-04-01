/**
 * Shared Logger
 * Simple logger for shared utilities
 */

const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] ${message}`, meta);
  },

  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, meta);
  },

  error: (message, meta = {}) => {
    console.error(`[ERROR] ${message}`, meta);
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, meta);
    }
  },
};

module.exports = logger;
