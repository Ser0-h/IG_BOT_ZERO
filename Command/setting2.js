const userService = require('../../database/services/userService');
const User = require('../../database/models/User');

module.exports = {
  name: 'settings',
  description: 'View or change your personal settings (usage: !settings lang bn)',
  restricted: false,
  async run(ctx) {
    const [key, value] = ctx.args;
    if (!key) {
      return ctx.reply(`⚙️ Your settings: ${JSON.stringify(ctx.user.settings || {})}`);
    }
    await User.updateOne({ igId: ctx.senderId }, { $set: { [`settings.${key}`]: value } });
    await ctx.reply(`✅ Set ${key} = ${value}`);
  },
};
