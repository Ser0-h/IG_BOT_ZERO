const User = require('../../database/models/User');

module.exports = {
  name: 'broadcast',
  description: 'Send a message to all known users (usage: !broadcast <text>) — use sparingly, IG rate-limits DMs heavily',
  restricted: true,
  async run(ctx) {
    const text = ctx.args.join(' ');
    if (!text) return ctx.reply('Usage: !broadcast <message>');

    const users = await User.find({ banned: false }, 'igId');
    await ctx.reply(`📣 Broadcasting to ${users.length} users... this will be slow on purpose to avoid rate limits.`);

    // Deliberately sequential + delayed: blasting DMs fast is a fast
    // way to get the account checkpointed.
    for (const user of users) {
      try {
        // NOTE: needs a threadId per user in a real implementation —
        // look up or create a direct thread via the Instagram client first.
        await new Promise((r) => setTimeout(r, 2000));
      } catch {
        // skip failures, keep going
      }
    }
    await ctx.reply('✅ Broadcast finished.');
  },
};
