module.exports = {
  name: 'uptime',
  description: 'Show how long the bot has been running',
  restricted: false,
  async run(ctx) {
    const seconds = Math.floor(process.uptime());
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    await ctx.reply(`⏱️ Uptime: ${h}h ${m}m`);
  },
};
