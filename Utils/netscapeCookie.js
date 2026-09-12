/**
 * Parses the standard "Netscape cookie file" format (the same format
 * curl -c, wget --save-cookies, and browser extensions like
 * "Get cookies.txt" export). One cookie per line, tab-separated:
 *
 *   domain  includeSubdomains  path  secure  expires  name  value
 *
 * Lines starting with # are comments (except the special
 * "#HttpOnly_" prefix some exporters use, which we also handle).
 */
const fs = require('fs');
const { Cookie } = require('tough-cookie');

function parseNetscapeFile(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  const cookies = [];

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;

    // Some exporters mark HttpOnly cookies with this prefix instead of a plain comment.
    const httpOnly = line.startsWith('#HttpOnly_');
    if (httpOnly) line = line.replace('#HttpOnly_', '');

    if (line.startsWith('#')) continue; // regular comment, skip

    const parts = line.split('\t');
    if (parts.length < 7) continue; // malformed line, skip safely

    const [domain, includeSubdomainsRaw, path, secureRaw, expiresRaw, name, value] = parts;

    cookies.push({
      domain: domain.replace(/^\./, ''), // tough-cookie wants bare domain
      hostOnly: !domain.startsWith('.'),
      path,
      secure: secureRaw.toUpperCase() === 'TRUE',
      httpOnly,
      expires: Number(expiresRaw) > 0 ? new Date(Number(expiresRaw) * 1000) : 'Infinity',
      key: name,
      value,
    });
  }

  return cookies;
}

/**
 * Loads parsed cookies into an existing tough-cookie CookieJar
 * (e.g. the one inside instagram-private-api's ig.state.cookieJar).
 */
function loadIntoJar(jar, cookies, url = 'https://www.instagram.com') {
  for (const c of cookies) {
    const cookie = new Cookie(c);
    jar.setCookieSync(cookie, url, { ignoreError: true });
  }
}

module.exports = { parseNetscapeFile, loadIntoJar };
