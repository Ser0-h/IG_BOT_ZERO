const userService = require('../../database/services/userService');

module.exports = {
  name: 'ban',
  description: 'Ban a user by igId (usage: !ban <igId>)',
  restricted: true,
  async run(ctx) {
    const [targetId] = ctx.args;
    if (!targetId) return ctx.reply('Usage: !ban <igId>');
    await userService.setBanned(targetId, true);
    await ctx.reply(`🚫 Banned ${targetId}`);
  },
};
