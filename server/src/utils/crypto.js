'use strict';

const crypto = require('node:crypto');
const config = require('../config/env');
const ApiError = require('./ApiError');

/**
 * Authenticated encryption for mailbox credentials at rest.
 *
 * AES-256-GCM with a random IV per value. The auth tag is stored alongside, so a
 * tampered ciphertext fails to decrypt rather than yielding garbage.
 *
 * Format: v1:<iv-hex>:<tag-hex>:<ciphertext-hex>
 */
const ALGO = 'aes-256-gcm';
const VERSION = 'v1';

function key() {
  if (!config.MAIL_ENCRYPTION_KEY) {
    throw ApiError.badRequest(
      'MAIL_ENCRYPTION_KEY is not set on the server, so mailbox credentials cannot be stored securely. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(config.MAIL_ENCRYPTION_KEY, 'hex');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12); // 96-bit IV is the GCM standard
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join(
    ':'
  );
}

function decrypt(payload) {
  const [version, ivHex, tagHex, dataHex] = String(payload).split(':');
  if (version !== VERSION || !ivHex || !tagHex || !dataHex) {
    throw new Error('Stored credential is not in the expected format');
  }
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
