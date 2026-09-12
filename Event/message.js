const logger = require('../utils/logger');

module.exports = {
  name: 'messageLogger',
  on(bot) {
    bot.on('message', async (ctx) => {
      logger.debug(`DM from @${ctx.senderUsername}: ${ctx.text}`);
    });
  },
};
