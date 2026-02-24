/**
 * Phase 0 — Encryption Unit Tests
 */
import { encrypt, decrypt } from '../../src/lib/encryption.js';

// Test key — 32 bytes hex = 64 chars
const TEST_KEY = 'a'.repeat(64);

beforeAll(() => {
  process.env.SESSION_TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

afterAll(() => {
  delete process.env.SESSION_TOKEN_ENCRYPTION_KEY;
});

describe('AES-256-CBC encryption', () => {
  it('encrypts a string and returns hex ciphertext + iv', () => {
    const { encrypted, iv } = encrypt('test_session_token');
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    expect(iv).toMatch(/^[0-9a-f]+$/);
    expect(iv).toHaveLength(32); // 16 bytes = 32 hex chars
  });

  it('decrypts back to original plaintext', () => {
    const plaintext = 'IGQVJXa1b2c3d4e5f6g7h8i9j0';
    const { encrypted, iv } = encrypt(plaintext);
    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for same input (different IV each time)', () => {
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

  it('handles unicode characters in plaintext', () => {
    const plaintext = 'session_with_üñïcödé';
    const { encrypted, iv } = encrypt(plaintext);
    expect(decrypt(encrypted, iv)).toBe(plaintext);
  });
});
