const logger = require('../utils/logger');

module.exports = {
  name: 'followTracker',
  on(bot) {
    bot.on('follow', async (ctx) => {
      logger.info(`New follower: @${ctx.senderUsername}`);
    });
  },
};
