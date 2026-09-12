const InstagramClient = require('./api/instagram');
const EventHandler = require('./handler/eventHandler');
const { createMessageHandler } = require('./handler/messageHandler');
const logger = require('../utils/logger');

class Bot {
  constructor(config, credentials) {
    this.config = config;
    this.ig = new InstagramClient(credentials);
    this.events = new EventHandler();
    this.middlewares = [];
    this.commands = new Map();
    this.seenMessageIds = new Set(); // avoid re-processing on each poll
    this.pollTimer = null;
  }

  // ---- setup -----------------------------------------------------
  use(middleware) {
    this.middlewares.push(middleware);
  }

  setCommands(commands) {
    this.commands = commands;
  }

  on(eventName, handler) {
    this.events.on(eventName, handler);
  }

  async initialize() {
    this.client = await this.ig.login();
  }

  // ---- lifecycle ---------------------------------------------------
  async start() {
    this.messageHandler = createMessageHandler({
      middlewares: this.middlewares,
      commands: this.commands,
      prefix: this.config.prefix || '!',
    });

    const intervalMs = this.config.pollIntervalMs || 5000; // practical default: gentle polling
    this.pollTimer = setInterval(() => this.poll().catch((e) => logger.error('Poll error:', e.message)), intervalMs);
    await this.poll(); // run once immediately
  }

  async stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    await this.ig.logout();
  }

  // ---- core polling loop --------------------------------------------
  // instagram-private-api has no reliable public realtime hook for
  // every account type, so polling the inbox is the practical,
  // dependable option. Kept slow on purpose (see pollIntervalMs)
  // to stay well under automation-detection thresholds.
  async poll() {
    const inbox = this.client.feed.directInbox();
    const threads = await inbox.items();

    for (const thread of threads) {
      const lastMessage = thread.items?.[0];
      if (!lastMessage || this.seenMessageIds.has(lastMessage.item_id)) continue;
      this.seenMessageIds.add(lastMessage.item_id);

      if (lastMessage.user_id === this.client.state.cookieUserId) continue; // ignore our own messages

      const ctx = {
        threadId: thread.thread_id,
        senderId: String(lastMessage.user_id),
        senderUsername: thread.users?.find((u) => u.pk === lastMessage.user_id)?.username || 'unknown',
        text: lastMessage.text || '',
        raw: lastMessage,
        reply: (text) => this.ig.sendText(thread.thread_id, text),
      };

      await this.events.emit('message', ctx);
      await this.messageHandler(ctx);
    }

    // keep the seen-set from growing forever
    if (this.seenMessageIds.size > 5000) {
      this.seenMessageIds = new Set([...this.seenMessageIds].slice(-1000));
    }
  }
}

module.exports = Bot;
