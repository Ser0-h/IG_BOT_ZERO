const http = require('http');
const logger = require('../../utils/logger');

/**
 * Minimal webhook receiver. Verifies a shared secret so random
 * traffic on the internet can't trigger bot commands remotely.
 */
function createWebhookServer({ port, secret, onEvent }) {
  const server = http.createServer((req, res) => {
    if (req.headers['x-webhook-secret'] !== secret) {
      res.writeHead(401).end('Unauthorized');
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        onEvent(payload);
        res.writeHead(200).end('OK');
      } catch (err) {
        logger.warn('Webhook: bad payload:', err.message);
        res.writeHead(400).end('Bad Request');
      }
    });
  });

  server.listen(port, () => logger.info(`📡 Webhook server listening on port ${port}`));
  return server;
}

module.exports = { createWebhookServer };
