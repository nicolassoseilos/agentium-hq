// Builds the published site into docs/ (served by GitHub Pages).
//
//   npm run build                       -> uses the saved password (.hq-password)
//   npm run build -- --new-password     -> makes a new random password (signs out every device)
//   npm run build -- --password "..."   -> sets a password you choose (signs out every device)
//
// The HQ (code, styling, markup, three.js) is bundled into one file, gzipped and
// encrypted with AES-256-GCM. The key comes from "agentium-ceo" + the password
// via PBKDF2-SHA256 (600k rounds). docs/ only ever holds the login gate and the
// encrypted app.bin. The password itself is never committed (.hq-password is
// git-ignored); the salt in scripts/gate.json is not secret.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const PASS_FILE = path.join(ROOT, '.hq-password');
const GATE_FILE = path.join(ROOT, 'scripts', 'gate.json');
const USERNAME = 'agentium-ceo';
const ITERATIONS = 600000;

const args = process.argv.slice(2);
const argPass = args.includes('--password') ? args[args.indexOf('--password') + 1] : null;
const fresh = args.includes('--new-password') || !!argPass;

function randomPassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('')).join('-');
}

// ---------------------------------------------------------------- password + salt
let password = process.env.AHQ_PASSWORD || (!fresh && fs.existsSync(PASS_FILE) ? fs.readFileSync(PASS_FILE, 'utf8').trim() : null);
let gate = !fresh && fs.existsSync(GATE_FILE) ? JSON.parse(fs.readFileSync(GATE_FILE, 'utf8')) : null;
let announce = false;
if (!password || fresh) {
  password = argPass || randomPassword();
  gate = null;
  announce = true;
}
if (!gate) gate = { salt: crypto.randomBytes(16).toString('base64'), iterations: ITERATIONS };
fs.writeFileSync(PASS_FILE, password + '\n', { mode: 0o600 });
fs.writeFileSync(GATE_FILE, JSON.stringify(gate, null, 2) + '\n');

// ---------------------------------------------------------------- bundle
const result = await esbuild.build({
  entryPoints: [path.join(ROOT, 'public/js/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2022',
  legalComments: 'none',
});
const js = result.outputFiles[0].text;
const css = fs.readFileSync(path.join(ROOT, 'public/css/app.css'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const html = index
  .slice(index.indexOf('<body>') + 6, index.indexOf('</body>'))
  .replace(/<script type="module"[^>]*><\/script>/, '')
  .trim();

const payload = zlib.gzipSync(Buffer.from(JSON.stringify({ css, html, js, built: new Date().toISOString() })), { level: 9 });

// ---------------------------------------------------------------- encrypt
const salt = Buffer.from(gate.salt, 'base64');
const key = crypto.pbkdf2Sync(`${USERNAME}\n${password}`, salt, gate.iterations, 32, 'sha256');
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
const header = Buffer.alloc(36);
header.write('AHQ1', 0, 'ascii');
salt.copy(header, 4);
iv.copy(header, 20);
header.writeUInt32BE(gate.iterations, 32);

// ---------------------------------------------------------------- write docs/
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'app.bin'), Buffer.concat([header, enc]));
fs.copyFileSync(path.join(ROOT, 'scripts/gate.html'), path.join(OUT, 'index.html'));
// 3D models (rooftop guests): gzipped and encrypted with the same key
const MODELS = path.join(ROOT, 'public/models');
if (fs.existsSync(MODELS)) {
  fs.mkdirSync(path.join(OUT, 'models'), { recursive: true });
  for (const f of fs.readdirSync(MODELS).filter((x) => x.endsWith('.glb'))) {
    const miv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, miv);
    const body = Buffer.concat([c.update(zlib.gzipSync(fs.readFileSync(path.join(MODELS, f)), { level: 9 })), c.final(), c.getAuthTag()]);
    fs.writeFileSync(path.join(OUT, 'models', f.replace('.glb', '.bin')), Buffer.concat([Buffer.from('AHQM'), miv, body]));
  }
}
// Live data module (team-build session, 19 Nov 2026): a plain script the gate loads before the bundle. It holds
// no secrets (Supabase's publishable key; every table is closed, the data needs Nicolas's login).
const LIVE = path.join(ROOT, 'public/live');
if (fs.existsSync(LIVE)) {
  fs.mkdirSync(path.join(OUT, 'live'), { recursive: true });
  for (const f of fs.readdirSync(LIVE).filter((x) => x.endsWith('.js'))) fs.copyFileSync(path.join(LIVE, f), path.join(OUT, 'live', f));
}
fs.copyFileSync(path.join(ROOT, 'public/favicon.svg'), path.join(OUT, 'favicon.svg'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`\n  Built docs/  (app ${kb(js.length)} → encrypted ${kb(enc.length)})`);
console.log(`  Login name: ${USERNAME}`);
if (announce) console.log(`  Password:   ${password}\n  (saved in .hq-password, which is never committed — keep a copy somewhere safe)\n`);
else console.log('  Password unchanged (from .hq-password) — signed-in devices stay signed in.\n');
