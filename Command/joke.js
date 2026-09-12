const JOKES = [
  "Why don't programmers like nature? It has too many bugs.",
  "I told my computer I needed a break, and it froze.",
  "Why do Java developers wear glasses? Because they don't C#.",
];

module.exports = {
  name: 'joke',
  description: 'Get a random joke',
  restricted: false,
  async run(ctx) {
    await ctx.reply(JOKES[Math.floor(Math.random() * JOKES.length)]);
  },
};
