import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // bytes
const IV_LENGTH = 16; // bytes

function getEncryptionKey(): Buffer {
  const key = process.env.SESSION_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('SESSION_TOKEN_ENCRYPTION_KEY environment variable is required');
  }
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `SESSION_TOKEN_ENCRYPTION_KEY must be a ${KEY_LENGTH * 2}-character hex string (got ${key.length} chars)`
    );
  }
  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns { encrypted, iv } — both as hex strings.
 *
 * SECURITY: The plaintext (Instagram session token) is never logged or stored.
 * Only the encrypted output is written to the database.
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypts an AES-256-CBC encrypted hex string.
 *
 * SECURITY: The returned plaintext is the Instagram session token.
 * Never log, store, or return it in an API response.
 */
export function decrypt(encryptedHex: string, ivHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

  return decrypted.toString('utf8');
}
