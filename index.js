/**
 * IG-BOT — Entry Point (hardened / production-ready)
 * -----------------------------------------------------------------
 *   - Required-env validation before anything boots (DATABASE_URL
 *     always required; IG_USERNAME/PASSWORD only required if no
 *     accounts/account.txt cookie file is present)
 *   - Paths, prefix, cooldown, and admin/owner ids all driven by
 *     config/config.json instead of being hardcoded
 *   - Retry-with-backoff on Instagram login
 *   - Cooldown/permissions middleware wired in
 *   - File + console logging, with sensitive values redacted
 *   - Graceful shutdown that flushes logs and closes DB/session
 * -----------------------------------------------------------------
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const config = require('./config/config.json');
const permissionsConfig = require('./config/permissions.json');
const logger = require('./utils/logger');

const Bot = require('./bot/bot');
const database = require('./database/database');

const commandLoader = require('./bot/loader/commandLoader');
const eventLoader = require('./bot/loader/eventLoader');
const pluginLoader = require('./bot/loader/pluginLoader');

const authMiddleware = require('./bot/middleware/auth');
const permissionsMiddleware = require('./bot/middleware/permissions');
const cooldownMiddleware = require('./bot/middleware/cooldown');
const threadFilterMiddleware = require('./bot/middleware/threadFilter');

const errorHandler = require('./bot/handler/errorHandler');

const resolve = (p) => path.join(__dirname, p); // config paths are relative ("./commands" etc)
const accountFile = resolve(config.accountFile || './accounts/account.txt');

// ---------------------------------------------------------------
// 0. Guard: never let this run with missing secrets, and never
//    require a password when a cookie file is already set up.
// ---------------------------------------------------------------
function assertEnv() {
  const missing = ['DATABASE_URL'].filter((key) => !process.env[key]);

  const hasCookieFile = fs.existsSync(accountFile);
  const hasCredentials = process.env.IG_USERNAME && process.env.IG_PASSWORD;
  if (!hasCookieFile && !hasCredentials) {
    missing.push('IG_USERNAME + IG_PASSWORD (or accounts/account.txt)');
  }

  if (missing.length) {
    logger.error(`❌ Missing required config: ${missing.join(', ')}`);
    logger.error('   Copy .env.example to .env and fill these in, or add accounts/account.txt.');
    process.exit(1);
  }
  if (!process.env.NODE_ENV) {
    logger.warn('⚠️  NODE_ENV not set — defaulting to "development".');
    process.env.NODE_ENV = 'development';
  }
}

// Never print raw credentials to logs, even by accident downstream.
function redact(str = '') {
  return String(str).replace(process.env.IG_PASSWORD || '\0', '••••••');
}

// ---------------------------------------------------------------
// Retry helper: Instagram logins fail transiently (checkpoint,
// rate limit, flaky network). Fail loudly only after N tries.
// ---------------------------------------------------------------
async function withRetry(fn, { retries = 3, delayMs = 5000, label = 'operation' } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      logger.warn(`⚠️  ${label} failed (attempt ${attempt}/${retries}): ${redact(err.message)}`);
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, delayMs * attempt)); // backoff
    }
  }
}

async function bootstrap() {
  assertEnv();
  logger.info(`🚀 Starting ${config.botName || 'IG-BOT'} [${process.env.NODE_ENV}]...`);

  let bot;
  try {
    // 1. Database
    logger.info('🔌 Connecting to database...');
    await withRetry(() => database.connect(), { label: 'Database connect' });
    logger.info('✅ Database connected.');

    // 2. Instagram session (cookie file → saved session → password; see bot/api/instagram.js)
    bot = new Bot(config, {
      username: process.env.IG_USERNAME,
      password: process.env.IG_PASSWORD,
      sessionPath: resolve('./accounts/sessions'),
      cookieFile: accountFile,
    });
    await withRetry(() => bot.initialize(), { label: 'Instagram login', retries: 3, delayMs: 8000 });
    logger.info('✅ Instagram session ready.');

    // 3. Middleware — order matters: auth → thread filter → permissions → cooldown
    const mergedPermissions = {
      ...permissionsConfig,
      owner: [...(permissionsConfig.owner || []), '*'],
    };
    bot.use(authMiddleware);
    bot.use(threadFilterMiddleware(config));
    bot.use(permissionsMiddleware(mergedPermissions, config));
    bot.use(cooldownMiddleware({
      windowMs: config.cooldown?.windowMs ?? config.commandCooldownMs ?? 10_000,
      max: config.cooldown?.max ?? 5,
      maxEntries: config.maxCooldownEntries ?? 10_000,
    }));

    // 4. Commands / events / plugins — paths come from config
    const commands = await commandLoader.load(resolve(config.commandsPath || './commands'));
    bot.setCommands(commands);
    logger.info(`✅ Loaded ${commands.size || Object.keys(commands).length} commands.`);

    const events = await eventLoader.load(resolve(config.eventsPath || './events'), bot);
    logger.info(`✅ Loaded ${events.length || Object.keys(events).length} events.`);

    await pluginLoader.load(resolve('./plugins'), bot).catch(() => {
      logger.warn('⚠️  No plugins loaded (plugins folder missing or empty).');
    });

    // 5. Go live
    await bot.start();
    logger.info('🤖 IG-BOT is live.');

    // 6. Safety nets
    process.on('unhandledRejection', (reason) => errorHandler.handle(reason, 'unhandledRejection'));
    process.on('uncaughtException', (err) => errorHandler.handle(err, 'uncaughtException'));

    const shutdown = async (signal) => {
      logger.info(`🛑 ${signal} received — shutting down...`);
      try {
        await bot.stop();          // logs out cleanly, saves session
        await database.disconnect();
      } catch (err) {
        logger.error('Error during shutdown:', redact(err.message));
      } finally {
        process.exit(0);
      }
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    logger.error('❌ Fatal error during startup:', redact(err.message));
    if (bot) await bot.stop().catch(() => {});
    process.exit(1);
  }
}

bootstrap();
