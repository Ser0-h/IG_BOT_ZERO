const logger = require('../utils/logger');

module.exports = {
  name: 'reactionTracker',
  on(bot) {
    bot.on('reaction', async (ctx) => {
      logger.debug(`Reaction from @${ctx.senderUsername}: ${ctx.emoji}`);
    });
  },
};
