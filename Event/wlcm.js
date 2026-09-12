module.exports = {
  name: 'welcome',
  on(bot) {
    bot.on('follow', async (ctx) => {
      await ctx.reply?.(`👋 Welcome, thanks for the follow!`);
    });
  },
};
