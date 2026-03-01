import crypto from 'crypto';

/**
 * Service for encrypting and decrypting sensitive data like repository credentials
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private encryptionKey: Buffer;

  constructor(encryptionKey?: string) {
    // Use provided key or generate from environment variable
    const keySource = encryptionKey || process.env.ENCRYPTION_KEY;
    
    if (!keySource) {
      throw new Error('Encryption key is required. Set ENCRYPTION_KEY environment variable.');
    }

    // Derive a proper 256-bit key from the provided key
    this.encryptionKey = crypto.scryptSync(keySource, 'salt', this.keyLength);
  }

  /**
   * Encrypt plaintext data
   * @param plaintext - The data to encrypt
   * @returns Encrypted data in format: iv:authTag:ciphertext (all base64 encoded)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty plaintext');
    }

    // Generate random IV for each encryption
    const iv = crypto.randomBytes(this.ivLength);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    // Encrypt the data
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    // Get authentication tag
    const authTag = (cipher as any).getAuthTag();
    
    // Return format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
  }

  /**
   * Decrypt encrypted data
   * @param encrypted - The encrypted data in format: iv:authTag:ciphertext
   * @returns Decrypted plaintext
   */
  decrypt(encrypted: string): string {
    if (!encrypted) {
      throw new Error('Cannot decrypt empty string');
    }

    // Parse the encrypted data
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    try {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const ciphertext = parts[2];

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      (decipher as any).setAuthTag(authTag);

      // Decrypt the data
      let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (error) {
      throw new Error('Decryption failed: data may be corrupted or tampered with');
    }
  }

  /**
   * Generate a random encryption key suitable for use with this service
   * @returns A random 32-byte key encoded as base64
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }
}

// Export singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}
