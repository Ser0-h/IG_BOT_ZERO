/**
 * Gates messages by thread using config.allowedThreads / blockedThreads.
 * Empty allowedThreads = allow everywhere (except explicitly blocked).
 */
module.exports = function threadFilter(config) {
  const allowed = config.allowedThreads || [];
  const blocked = config.blockedThreads || [];

  return async function threadFilterMiddleware(ctx, next) {
    if (blocked.includes(ctx.threadId)) return; // silently drop, no reply
    if (allowed.length > 0 && !allowed.includes(ctx.threadId)) return;
    return next();
  };
};
