/**
 * Thin wrapper around `instagram-private-api`.
 * Keeps session on disk so we don't log in fresh every restart
 * (repeated logins are what gets accounts flagged/checkpointed).
 */
const fs = require('fs');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');
const logger = require('../../utils/logger');
const { parseNetscapeFile, loadIntoJar } = require('../../utils/netscapeCookies');

class InstagramClient {
  constructor({ username, password, sessionPath, cookieFile }) {
    this.username = username;
    this.password = password;
    this.sessionPath = sessionPath;
    // Defaults to accounts/account.txt (Netscape cookie format) —
    // one directory above sessionPath (accounts/sessions).
    this.cookieFile = cookieFile || path.join(sessionPath, '..', 'account.txt');
    this.ig = new IgApiClient();
  }

  get sessionFile() {
    return path.join(this.sessionPath, `${this.username}.json`);
  }

  async login() {
    this.ig.state.generateDevice(this.username);

    // 1. Prefer a saved (previously validated) session — fastest, no network risk.
    if (fs.existsSync(this.sessionFile)) {
      logger.info('🔑 Restoring saved session (no fresh login needed).');
      const saved = JSON.parse(fs.readFileSync(this.sessionFile, 'utf-8'));
      await this.ig.state.deserialize(saved);
      if (await this.isSessionValid()) return this.ig;
      logger.warn('⚠️  Saved session invalid/expired.');
    }

    // 2. Try the Netscape cookie file (accounts/account.txt) — lets you
    //    log in with a cookie exported from a real browser session,
    //    skipping username/password + IG's login-challenge flow entirely.
    if (fs.existsSync(this.cookieFile)) {
      logger.info('🍪 Loading session from account.txt (Netscape cookie format)...');
      const cookies = parseNetscapeFile(this.cookieFile);
      if (cookies.length) {
        loadIntoJar(this.ig.state.cookieJar, cookies);
        if (await this.isSessionValid()) {
          logger.info('✅ Cookie-based session accepted.');
          await this.saveSession();
          return this.ig;
        }
        logger.warn('⚠️  Cookies in account.txt are invalid or expired.');
      }
    }

    // 3. Last resort: real username/password login.
    if (!this.username || !this.password) {
      throw new Error('No valid session, no valid cookies, and no username/password provided.');
    }
    logger.info('🔐 Logging in with username/password...');
    await this.ig.simulate.preLoginFlow();
    await this.ig.account.login(this.username, this.password);
    await this.saveSession();
    return this.ig;
  }

  async isSessionValid() {
    try {
      await this.ig.account.currentUser();
      return true;
    } catch {
      return false;
    }
  }

  async saveSession() {
    if (!fs.existsSync(this.sessionPath)) fs.mkdirSync(this.sessionPath, { recursive: true });
    const serialized = await this.ig.state.serialize();
    delete serialized.constructor; // not JSON-safe
    fs.writeFileSync(this.sessionFile, JSON.stringify(serialized), { mode: 0o600 }); // owner-read-only
  }

  async sendText(threadId, text) {
    return this.ig.entity.directThread(threadId).broadcastText(text);
  }

  async logout() {
    try {
      await this.saveSession(); // persist cookies before leaving
    } catch (err) {
      logger.warn('Could not save session on logout:', err.message);
    }
  }
}

module.exports = InstagramClient;
