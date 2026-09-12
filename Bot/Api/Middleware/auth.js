const userService = require('../../database/services/userService');
const logger = require('../../utils/logger');

/**
 * Runs first on every incoming message. Ensures the sender exists
 * in the DB and is not banned, before anything else touches the event.
 */
module.exports = async function auth(ctx, next) {
  const { senderId, senderUsername } = ctx;

  const user = await userService.findOrCreate(senderId, senderUsername);
  if (user.banned) {
    logger.debug(`Blocked message from banned user ${senderUsername} (${senderId})`);
    return; // silently drop — don't let banned users know they're banned
  }

  ctx.user = user;
  await userService.touchActivity(senderId);
  return next();
};
