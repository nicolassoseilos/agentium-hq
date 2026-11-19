// Creates (or replaces) the single login for Agentium HQ.
//   npm run set-password            -> generates a random password and prints it once
//   npm run set-password -- "pass"  -> uses the password you give
// Writes config/auth.json (git-ignored). Changing the password also rotates the
// session secret, which signs every device out.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.env.AHQ_AUTH_FILE || path.join(ROOT, 'config', 'auth.json');

function randomPassword() {
  // 4 groups of 5 from an unambiguous alphabet, e.g. "k7Qm2-Xp9vT-..." (~110 bits)
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let s = '';
    for (let i = 0; i < 5; i++) s += alphabet[crypto.randomInt(alphabet.length)];
    groups.push(s);
  }
  return groups.join('-');
}

const password = process.argv[2] || randomPassword();
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);

const config = {
  username: 'agentium-ceo',
  passwordHash: `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`,
  sessionSecret: crypto.randomBytes(48).toString('base64url'),
};

fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });

console.log('\n  Agentium HQ login saved to', path.relative(ROOT, file));
console.log('  Username: agentium-ceo');
if (!process.argv[2]) console.log('  Password:', password, '\n  (shown once — let your browser save it)\n');
