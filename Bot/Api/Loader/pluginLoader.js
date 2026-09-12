const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Plugins are optional. Each plugin file exports: (bot) => { ... }
 * A broken plugin should never take the whole bot down — each one
 * is loaded in its own try/catch.
 */
async function load(pluginsPath, bot) {
  if (!fs.existsSync(pluginsPath)) {
    return []; // no plugins folder — perfectly fine, not an error
  }

  const loaded = [];
  for (const file of fs.readdirSync(pluginsPath)) {
    if (!file.endsWith('.js')) continue;
    const fullPath = path.join(pluginsPath, file);

    try {
      const plugin = require(fullPath);
      if (typeof plugin !== 'function') {
        logger.warn(`⚠️  Skipping plugin ${file} — must export a function(bot)`);
        continue;
      }
      await plugin(bot);
      loaded.push(file);
      logger.info(`🔌 Plugin loaded: ${file}`);
    } catch (err) {
      logger.error(`Plugin ${file} failed to load (skipped, bot continues):`, err.message);
    }
  }
  return loaded;
}

module.exports = { load };
