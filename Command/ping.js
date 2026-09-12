module.exports = {
  name: 'ping',
  description: 'Check if the bot is alive',
  restricted: false,
  async run(ctx) {
    const start = Date.now();
    await ctx.reply(`🏓 Pong! (${Date.now() - start}ms)`);
  },
};
