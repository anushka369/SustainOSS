import fc from 'fast-check';
import { EncryptionService } from '../EncryptionService';

/**
 * Property-Based Tests for EncryptionService
 * Feature: sustainoss
 * Property 31: Credential Encryption at Rest
 * Validates: Requirements 10.4
 */

describe('EncryptionService - Property Tests', () => {
  let encryptionService: EncryptionService;

  beforeAll(() => {
    // Use a test encryption key
    encryptionService = new EncryptionService('test-encryption-key-for-property-tests');
  });

  /**
   * Property 31: Credential Encryption at Rest
   * For any stored repository credentials, the stored value should be encrypted
   * and should not match the plaintext credential.
   */
  describe('Property 31: Credential Encryption at Rest', () => {
    it('should encrypt credentials so they do not match plaintext', () => {
      fc.assert(
        fc.property(
          fc.record({
            token: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            username: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            password: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            sshKeyPath: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          }),
          (credentials) => {
            // Skip if all fields are undefined
            if (
              !credentials.token &&
              !credentials.username &&
              !credentials.password &&
              !credentials.sshKeyPath
            ) {
              return true;
            }

            const plaintext = JSON.stringify(credentials);
            const encrypted = encryptionService.encrypt(plaintext);

            // Encrypted value should not match plaintext
            expect(encrypted).not.toBe(plaintext);

            // Encrypted value should be a string
            expect(typeof encrypted).toBe('string');

            // Encrypted value should have the expected format (iv:authTag:ciphertext)
            const parts = encrypted.split(':');
            expect(parts.length).toBe(3);

            // Each part should be base64 encoded (non-empty)
            parts.forEach((part) => {
              expect(part.length).toBeGreaterThan(0);
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should decrypt encrypted credentials back to original plaintext', () => {
      fc.assert(
        fc.property(
          fc.record({
            token: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
            username: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            password: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            sshKeyPath: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
          }),
          (credentials) => {
            // Skip if all fields are undefined
            if (
              !credentials.token &&
              !credentials.username &&
              !credentials.password &&
              !credentials.sshKeyPath
            ) {
              return true;
            }

            const plaintext = JSON.stringify(credentials);
            const encrypted = encryptionService.encrypt(plaintext);
            const decrypted = encryptionService.decrypt(encrypted);

            // Decrypted value should match original plaintext
            expect(decrypted).toBe(plaintext);

            // Verify the credentials object is intact
            const decryptedCredentials = JSON.parse(decrypted);
            expect(decryptedCredentials).toEqual(credentials);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different ciphertext for the same plaintext (due to random IV)', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (plaintext) => {
          const encrypted1 = encryptionService.encrypt(plaintext);
          const encrypted2 = encryptionService.encrypt(plaintext);

          // Different encryptions should produce different ciphertext
          expect(encrypted1).not.toBe(encrypted2);

          // But both should decrypt to the same plaintext
          expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
          expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should fail to decrypt tampered ciphertext', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          const parts = encrypted.split(':');

          // Tamper with the ciphertext by modifying the first character (actual data, not padding)
          // This ensures we're changing the encrypted data, not just base64 padding
          const firstChar = parts[2].charAt(0);
          const tamperedFirstChar = firstChar === 'A' ? 'B' : 'A';
          const tamperedCiphertext = tamperedFirstChar + parts[2].slice(1);
          const tamperedEncrypted = `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;

          // Decryption should fail
          expect(() => {
            encryptionService.decrypt(tamperedEncrypted);
          }).toThrow();

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty credentials gracefully', () => {
      expect(() => {
        encryptionService.encrypt('');
      }).toThrow('Cannot encrypt empty plaintext');
    });

    it('should handle invalid encrypted format gracefully', () => {
      expect(() => {
        encryptionService.decrypt('invalid-format');
      }).toThrow('Invalid encrypted data format');

      expect(() => {
        encryptionService.decrypt('');
      }).toThrow('Cannot decrypt empty string');
    });
  });

  describe('Encryption key generation', () => {
    it('should generate unique encryption keys', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();

      expect(key1).not.toBe(key2);
      expect(key1.length).toBeGreaterThan(0);
      expect(key2.length).toBeGreaterThan(0);
    });
  });
});
