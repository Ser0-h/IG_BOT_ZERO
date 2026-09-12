module.exports = {
  name: 'help',
  description: 'List available commands',
  restricted: false,
  async run(ctx) {
    // ctx.bot isn't passed by default — keep this simple and static,
    // or wire ctx.commands through messageHandler if you want it dynamic.
    await ctx.reply('Available: !ping, !help, !profile, !balance, !joke, !meme');
  },
};
