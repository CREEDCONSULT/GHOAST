import { createCipheriv, randomBytes } from 'crypto';
import { encrypt, decrypt } from '../../src/lib/encryption.js';

const TEST_KEY = 'a'.repeat(64);

beforeAll(() => {
  process.env.SESSION_TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.SESSION_TOKEN_ENCRYPTION_KEY;
});

describe('session token encryption', () => {
  it('encrypts a string and returns authenticated ciphertext + iv', () => {
    const { encrypted, iv } = encrypt('test_session_token');
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    expect(iv).toMatch(/^[0-9a-f]+$/);
    expect(iv).toHaveLength(24);
  });

  it('decrypts back to original plaintext', () => {
    const plaintext = 'IGQVJXa1b2c3d4e5f6g7h8i9j0';
    const { encrypted, iv } = encrypt(plaintext);
    expect(decrypt(encrypted, iv)).toBe(plaintext);
  });

  it('produces different ciphertext for same input', () => {
    const plaintext = 'same_session_token';
    const result1 = encrypt(plaintext);
    const result2 = encrypt(plaintext);
    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('throws if SESSION_TOKEN_ENCRYPTION_KEY is missing', () => {
    delete process.env.SESSION_TOKEN_ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('SESSION_TOKEN_ENCRYPTION_KEY');
    process.env.SESSION_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it('throws if key is wrong length', () => {
    process.env.SESSION_TOKEN_ENCRYPTION_KEY = 'short';
    expect(() => encrypt('test')).toThrow();
    process.env.SESSION_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it('rejects tampered ciphertext', () => {
    const { encrypted, iv } = encrypt('test_session_token');
    const tampered = encrypted.replace(/^[0-9a-f]/, (char) => (char === 'a' ? 'b' : 'a'));
    expect(() => decrypt(tampered, iv)).toThrow();
  });

  it('decrypts legacy AES-256-CBC payloads for backward compatibility', () => {
    const key = Buffer.from(TEST_KEY, 'hex');
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([
      cipher.update('legacy_session_token', 'utf8'),
      cipher.final(),
    ]).toString('hex');

    expect(decrypt(encrypted, iv.toString('hex'))).toBe('legacy_session_token');
  });

  it('handles unicode characters in plaintext', () => {
    const plaintext = 'session_with_unicode_chars';
    const { encrypted, iv } = encrypt(plaintext);
    expect(decrypt(encrypted, iv)).toBe(plaintext);
  });
});
