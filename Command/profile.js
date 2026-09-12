module.exports = {
  name: 'balance',
  description: 'Check your balance',
  restricted: false,
  async run(ctx) {
    await ctx.reply(`💰 Your balance: ${ctx.user.balance}`);
  },
};
