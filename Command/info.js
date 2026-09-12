module.exports = {
  name: 'info',
  description: 'Show bot info',
  restricted: false,
  async run(ctx) {
    await ctx.reply('🤖 IG-BOT — Node.js Instagram automation bot.');
  },
};
