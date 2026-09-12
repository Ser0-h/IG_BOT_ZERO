const logger = require('../../utils/logger');

/**
 * Wraps fetch with a timeout and basic retry so a slow third-party
 * API (AI provider, webhook target) never hangs the bot forever.
 */
async function request(url, options = {}, { timeoutMs = 10_000, retries = 1 } = {}) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries + 1) {
        logger.error(`Request to ${url} failed:`, err.message);
        throw err;
      }
    }
  }
}

module.exports = { request };
