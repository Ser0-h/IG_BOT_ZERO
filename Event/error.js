const logger = require('../utils/logger');

module.exports = {
  name: 'errorLogger',
  on(bot) {
    bot.on('error', async (err) => {
      logger.error('Bot-level error event:', err.message || err);
    });
  },
};
