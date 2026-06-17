import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const GCM_ALGORITHM = 'aes-256-gcm';
const LEGACY_CBC_ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // bytes
const GCM_IV_LENGTH = 12; // bytes
const LEGACY_CBC_IV_LENGTH = 16; // bytes
const AUTH_TAG_LENGTH = 16; // bytes

function getEncryptionKey(): Buffer {
  const key = process.env.SESSION_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SESSION_TOKEN_ENCRYPTION_KEY environment variable is required');
  }
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `SESSION_TOKEN_ENCRYPTION_KEY must be a ${KEY_LENGTH * 2}-character hex string (got ${key.length} chars)`,
    );
  }
  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The encrypted payload is stored as "ciphertext:authTag" so authenticated
 * encryption fits the existing encrypted-token + IV database columns.
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv(GCM_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: `${encrypted.toString('hex')}:${authTag.toString('hex')}`,
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypts AES-256-GCM payloads and legacy AES-256-CBC payloads.
 */
export function decrypt(encryptedHex: string, ivHex: string): string {
  if (encryptedHex.includes(':')) {
    return decryptGcm(encryptedHex, ivHex);
  }
  return decryptLegacyCbc(encryptedHex, ivHex);
}

function decryptGcm(encryptedPayload: string, ivHex: string): string {
  const [ciphertextHex, authTagHex] = encryptedPayload.split(':');
  if (!ciphertextHex || !authTagHex) {
    throw new Error('Invalid encrypted payload');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  if (iv.length !== GCM_IV_LENGTH) {
    throw new Error(`AES-GCM IV must be ${GCM_IV_LENGTH} bytes`);
  }

  const encryptedBuffer = Buffer.from(ciphertextHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`AES-GCM auth tag must be ${AUTH_TAG_LENGTH} bytes`);
  }

  const decipher = createDecipheriv(GCM_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

  return decrypted.toString('utf8');
}

function decryptLegacyCbc(encryptedHex: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  if (iv.length !== LEGACY_CBC_IV_LENGTH) {
    throw new Error(`AES-CBC IV must be ${LEGACY_CBC_IV_LENGTH} bytes`);
  }

  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv(LEGACY_CBC_ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

  return decrypted.toString('utf8');
}
