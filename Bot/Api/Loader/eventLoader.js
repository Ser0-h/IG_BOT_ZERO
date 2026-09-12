const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Each file in events/ must export: { name, on(bot) }
 * `name` is just for logging; `on(bot)` should call bot.on(...) itself,
 * so an event file can bind to one or more bot events.
 */
async function load(eventsPath, bot) {
  const loaded = [];
  if (!fs.existsSync(eventsPath)) return loaded;

  for (const file of fs.readdirSync(eventsPath)) {
    if (!file.endsWith('.js')) continue;
    const fullPath = path.join(eventsPath, file);

    try {
      delete require.cache[require.resolve(fullPath)];
      const event = require(fullPath);

      if (!event?.name || typeof event.on !== 'function') {
        logger.warn(`⚠️  Skipping invalid event file: ${fullPath} (needs name + on())`);
        continue;
      }
      event.on(bot);
      loaded.push(event.name);
    } catch (err) {
      logger.error(`Failed to load event ${fullPath}:`, err.message);
    }
  }

  return loaded;
}

module.exports = { load };
