const errorHandler = require('./errorHandler');

/**
 * Thin emitter used by bot.js — event files (events/*.js) call
 * bot.on(eventName, handler); this dispatches safely.
 */
class EventHandler {
  constructor() {
    this.listeners = new Map(); // eventName -> [handlers]
  }

  on(eventName, handler) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, []);
    this.listeners.get(eventName).push(handler);
  }

  async emit(eventName, payload) {
    const handlers = this.listeners.get(eventName) || [];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (err) {
        errorHandler.handle(err, `event:${eventName}`);
      }
    }
  }
}

module.exports = EventHandler;
