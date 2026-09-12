const logger = require('../utils/logger');

module.exports = {
  name: 'unfollowTracker',
  on(bot) {
    bot.on('unfollow', async (ctx) => {
      logger.info(`Unfollowed: @${ctx.senderUsername}`);
    });
  },
};
