const settingsService = require('../../database/services/settingsService');

module.exports = {
  name: 'settings',
  description: 'Admin: get/set global bot settings (usage: !settings <key> [value])',
  restricted: true,
  async run(ctx) {
    const [key, ...rest] = ctx.args;
    if (!key) return ctx.reply('Usage: !settings <key> [value]');

    if (rest.length === 0) {
      const value = await settingsService.get(key);
      return ctx.reply(`${key} = ${JSON.stringify(value)}`);
    }
    await settingsService.set(key, rest.join(' '));
    await ctx.reply(`✅ ${key} updated.`);
  },
};
