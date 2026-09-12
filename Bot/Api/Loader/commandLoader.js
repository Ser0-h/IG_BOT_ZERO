const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Loads every .js file under commandsPath (recursively, one level
 * of subfolders like commands/admin/, commands/fun/, etc).
 * Each command file must export: { name, description, restricted?, run(ctx) }
 */
async function load(commandsPath) {
  const commands = new Map();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.js')) continue;

      try {
        delete require.cache[require.resolve(fullPath)]; // allow hot-reload in dev
        const command = require(fullPath);

        if (!command?.name || typeof command.run !== 'function') {
          logger.warn(`⚠️  Skipping invalid command file: ${fullPath} (needs name + run())`);
          continue;
        }
        if (commands.has(command.name)) {
          logger.warn(`⚠️  Duplicate command name "${command.name}" in ${fullPath} — overwriting.`);
        }
        commands.set(command.name, command);
      } catch (err) {
        logger.error(`Failed to load command ${fullPath}:`, err.message);
      }
    }
  }

  walk(commandsPath);
  return commands;
}

module.exports = { load };
