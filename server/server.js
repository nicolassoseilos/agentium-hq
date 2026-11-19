// Agentium HQ — private portal server.
// Zero dependencies. Serves the HQ app behind a single-user login.
// After the first sign-in on a device, a signed cookie keeps that device
// signed in for ten years, so the CEO is never asked again.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const AUTH_FILE = process.env.AHQ_AUTH_FILE || path.join(ROOT, 'config', 'auth.json');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const COOKIE = 'ahq_session';
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

// ---------------------------------------------------------------- auth config
function loadAuth() {
  // Environment variables win (handy for hosting panels); otherwise config/auth.json.
  if (process.env.AHQ_PASSWORD_HASH && process.env.AHQ_SESSION_SECRET) {
    return {
      username: process.env.AHQ_USERNAME || 'agentium-ceo',
      passwordHash: process.env.AHQ_PASSWORD_HASH,
      sessionSecret: process.env.AHQ_SESSION_SECRET,
    };
  }
  if (!fs.existsSync(AUTH_FILE)) {
    console.error(`\n  No login configured. Run:  npm run set-password\n`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
}
const auth = loadAuth();

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function sign(value) {
  return crypto.createHmac('sha256', auth.sessionSecret).update(value).digest('base64url');
}

function makeSession() {
  const payload = Buffer.from(JSON.stringify({ u: auth.username, iat: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw) return null;
  const [payload, mac] = raw.split('.');
  if (!payload || !mac) return null;
  const good = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.u === auth.username ? data : null;
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isHttps(req) {
  return process.env.AHQ_SECURE_COOKIE === '1' || req.headers['x-forwarded-proto'] === 'https';
}

// Simple brute-force brake: 10 failed attempts per IP per 15 minutes.
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > 15 * 60 * 1000) return false;
  return rec.count >= 10;
}
function noteFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > 15 * 60 * 1000) attempts.set(ip, { first: now, count: 1 });
  else rec.count++;
}

// ---------------------------------------------------------------- static files
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p.startsWith(base + path.sep) || p === base ? p : null;
}

function sendFile(res, file, cache = 'no-cache') {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache,
    });
    fs.createReadStream(file).pipe(res);
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function redirect(res, to, headers = {}) {
  res.writeHead(303, { Location: to, ...headers });
  res.end();
}

// Inline import map in index.html needs a CSP hash.
function importMapHash() {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  return m ? `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'` : '';
}
const IMPORTMAP_HASH = importMapHash();

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' ${IMPORTMAP_HASH}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
  );
}

// ---------------------------------------------------------------- routes
function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) reject(new Error('too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const url = new URL(req.url, 'http://local');
  const pathname = decodeURIComponent(url.pathname);
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (pathname === '/login' && req.method === 'GET') {
    if (readSession(req)) return redirect(res, '/');
    return sendFile(res, path.join(PUBLIC_DIR, 'login.html'));
  }

  if (pathname === '/login' && req.method === 'POST') {
    if (tooManyAttempts(ip)) return redirect(res, '/login?e=wait');
    let form;
    try {
      form = new URLSearchParams(await readBody(req));
    } catch {
      return redirect(res, '/login?e=1');
    }
    const okUser = form.get('username') === auth.username;
    const okPass = verifyPassword(form.get('password') || '', auth.passwordHash);
    if (!okUser || !okPass) {
      noteFailure(ip);
      return redirect(res, '/login?e=1');
    }
    attempts.delete(ip);
    const secure = isHttps(req) ? '; Secure' : '';
    return redirect(res, '/', {
      'Set-Cookie': `${COOKIE}=${makeSession()}; Max-Age=${TEN_YEARS}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    });
  }

  if (pathname === '/logout') {
    return redirect(res, '/login', { 'Set-Cookie': `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax` });
  }

  // Login page assets are public (brand mark only).
  if (pathname.startsWith('/login-assets/')) {
    const file = safeJoin(path.join(PUBLIC_DIR, 'login-assets'), pathname.slice('/login-assets/'.length));
    return file ? sendFile(res, file, 'public, max-age=86400') : notFound(res);
  }

  // Everything below requires a session.
  if (!readSession(req)) {
    if (pathname.startsWith('/api/')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end('{"error":"unauthorised"}');
    }
    return redirect(res, '/login');
  }

  // Placeholder for the live data step: the client will read /api/state.
  if (pathname === '/api/state') {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'live data not connected yet', source: 'sample' }));
  }

  // three.js, served from node_modules (build + addons only).
  if (pathname.startsWith('/vendor/three/')) {
    const rel = pathname.slice('/vendor/three/'.length);
    if (!rel.startsWith('build/') && !rel.startsWith('examples/jsm/')) return notFound(res);
    const file = safeJoin(THREE_DIR, rel);
    return file ? sendFile(res, file, 'public, max-age=604800, immutable') : notFound(res);
  }

  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (rel === 'login.html' || rel.startsWith('login-assets')) return redirect(res, '/');
  const file = safeJoin(PUBLIC_DIR, rel);
  return file ? sendFile(res, file) : notFound(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Agentium HQ running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});
