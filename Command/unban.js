const userService = require('../../database/services/userService');

module.exports = {
  name: 'unban',
  description: 'Unban a user by igId (usage: !unban <igId>)',
  restricted: true,
  async run(ctx) {
    const [targetId] = ctx.args;
    if (!targetId) return ctx.reply('Usage: !unban <igId>');
    await userService.setBanned(targetId, false);
    await ctx.reply(`✅ Unbanned ${targetId}`);
  },
};
