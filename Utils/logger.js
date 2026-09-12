const fs = require('fs');
const path = require('path');

let config = {};
try {
  config = require('../config/config.json');
} catch {
  // config not present yet (e.g. very first run) — fall back to defaults below
}

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

// Values that must never hit console or disk, even inside error messages.
function redact(msg) {
  let out = String(msg);
  [process.env.IG_PASSWORD, process.env.DATABASE_URL, config.chatApi?.token]
    .filter(Boolean)
    .forEach((secret) => {
      out = out.split(secret).join('••••••');
    });
  return out;
}

function write(level, args) {
  if (LEVELS[level] > currentLevel) return; // below configured logLevel, skip

  const time = new Date().toISOString();
  const message = args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' ');
  const line = `[${time}] [${level.toUpperCase()}] ${redact(message)}`;

  const color = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', debug: '\x1b[90m' }[level] || '';
  console.log(`${color}${line}\x1b[0m`);

  fs.appendFile(LOG_FILE, line + '\n', () => {}); // fire-and-forget, never crash on log write
}

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  debug: (...args) => write('debug', args),
};
