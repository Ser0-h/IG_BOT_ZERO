const logger = require('../../utils/logger');

/**
 * Central error sink. Command errors, event errors, and process-level
 * unhandledRejection/uncaughtException all funnel through here so
 * failures are logged consistently and never silently swallowed —
 * but also never crash the whole bot for a single bad command.
 */
function handle(err, context = 'unknown') {
  logger.error(`💥 Error in ${context}:`, err instanceof Error ? err.stack : err);

  // uncaughtException means the process is in an undefined state —
  // safer to exit and let a process manager (pm2/systemd) restart clean.
  if (context === 'uncaughtException') {
    logger.error('Unrecoverable error — exiting for a clean restart.');
    process.exit(1);
  }
  // unhandledRejection and command/event errors: log and keep running.
}

module.exports = { handle };
