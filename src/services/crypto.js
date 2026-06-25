'use strict';

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    // Dev fallback: derive from a placeholder. Production MUST set ENCRYPTION_KEY.
    return crypto.scryptSync('dev-only-not-secure-replace-in-prod', 'auto-blog-gen', 32);
  }
  // Accept either hex (64 chars = 32 bytes) or arbitrary string (scrypt-derived).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.scryptSync(raw, 'auto-blog-gen', 32);
}

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // packed format: base64(iv|tag|ciphertext)
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decrypt(packed) {
  if (packed == null) return null;
  const buf = Buffer.from(packed, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

module.exports = { encrypt, decrypt };
