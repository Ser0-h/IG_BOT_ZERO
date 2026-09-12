const Command = require('../../database/models/Command');
const errorHandler = require('./errorHandler');
const logger = require('../../utils/logger');

/**
 * Parses "!ping foo bar" style text into { name: 'ping', args: ['foo','bar'] }
 * using the configured prefix (default "!").
 */
function parseCommand(text, prefix = '!') {
  if (!text?.startsWith(prefix)) return null;
  const [name, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  return { name: name.toLowerCase(), args };
}

async function handleCommand(ctx, commands, prefix) {
  const parsed = parseCommand(ctx.text, prefix);
  if (!parsed) return false; // not a command, let message handler deal with it

  const command = commands.get(parsed.name);
  if (!command) {
    await ctx.reply?.(`❓ Unknown command "${parsed.name}". Try !help.`);
    return true;
  }

  ctx.command = command;
  ctx.args = parsed.args;

  try {
    await command.run(ctx);
    Command.create({ name: command.name, usedBy: ctx.senderId, threadId: ctx.threadId }).catch(() => {});
  } catch (err) {
    errorHandler.handle(err, `command:${command.name}`);
    await ctx.reply?.('⚠️ Something went wrong running that command.');
  }
  return true;
}

module.exports = { handleCommand, parseCommand };
