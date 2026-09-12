/**
 * Simple in-memory sliding-window rate limiter, keyed per user.
 * This is the single most important guard for an Instagram bot —
 * sending too many actions too fast is what gets accounts checkpointed
 * or permanently disabled.
 *
 * maxEntries caps memory use (config.maxCooldownEntries) — without
 * it, a bot with thousands of one-time senders would leak memory
 * forever since entries are never otherwise removed.
 */
module.exports = function cooldown({ windowMs = 10_000, max = 5, maxEntries = 10_000 } = {}) {
  const hits = new Map(); // igId -> [timestamps]

  function evictOldestIfFull() {
    if (hits.size < maxEntries) return;
    const oldestKey = hits.keys().next().value;
    hits.delete(oldestKey);
  }

  return async function cooldownMiddleware(ctx, next) {
    const id = ctx.senderId;
    const now = Date.now();
    const timestamps = (hits.get(id) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= max) {
      return ctx.reply?.('⏳ Slow down a bit — try again in a few seconds.');
    }

    timestamps.push(now);
    if (!hits.has(id)) evictOldestIfFull();
    hits.set(id, timestamps);
    return next();
  };
};
