const { request } = require('../../bot/api/request');
const config = require('../../config/config.json');

module.exports = {
  name: 'ai',
  description: 'Ask the AI something (usage: !ai <question>)',
  restricted: false,
  async run(ctx) {
    const question = ctx.args.join(' ');
    if (!question) return ctx.reply('Usage: !ai <your question>');

    const { url, token } = config.chatApi || {};
    if (!url || !token) return ctx.reply('⚠️ AI is not configured (set chatApi.url/token in config.json).');

    try {
      const res = await request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: question, userId: ctx.senderId }),
        },
        { timeoutMs: 15000, retries: 1 }
      );
      const data = await res.json();
      await ctx.reply(data.reply || data.answer || 'No response.');
    } catch (err) {
      await ctx.reply('⚠️ AI request failed, try again later.');
    }
  },
};
