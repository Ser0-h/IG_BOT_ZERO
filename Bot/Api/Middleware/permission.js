const logger = require('../../utils/logger');

/**
 * Role comes from two places, checked in order:
 *   1. config.ownerId / config.adminIds  (quick, no DB edit needed)
 *   2. ctx.user.role from the database   (set via !ban, admin tools, etc.)
 *
 * permissionsConfig example (config/permissions.json):
 * {
 *   "admin": ["ban", "unban", "broadcast", "settings"],
 *   "owner": ["*"]
 * }
 */
module.exports = function permissions(permissionsConfig, config = {}) {
  const ownerId = config.ownerId || '';
  const adminIds = config.adminIds || [];

  function resolveRole(ctx) {
    if (ctx.senderId === ownerId) return 'owner';
    if (adminIds.includes(ctx.senderId)) return 'admin';
    if (config.allowThreadAdmins && ctx.isThreadAdmin) return 'admin';
    return ctx.user?.role || 'user';
  }

  return async function permissionsMiddleware(ctx, next) {
    const command = ctx.command;
    if (!command || !command.restricted) return next(); // public command, no gate

    const role = resolveRole(ctx);
    const allowed = permissionsConfig[role] || [];

    if (allowed.includes('*') || allowed.includes(command.name)) {
      ctx.role = role;
      return next();
    }

    logger.debug(`Permission denied: ${ctx.senderUsername} (${role}) → ${command.name}`);
    return ctx.reply?.("🚫 You don't have permission to use this command.");
  };
};
