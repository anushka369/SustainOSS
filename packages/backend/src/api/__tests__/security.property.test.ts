import fc from 'fast-check';
import request from 'supertest';
import express, { Express } from 'express';
import {
  configureHelmet,
  enforceHttps,
  additionalSecurityHeaders,
  CSRFProtection,
} from '../middleware/security';

/**
 * Property-Based Tests for Security Headers
 * Feature: sustainoss
 * Property 32: Security Header Presence
 * Validates: Requirements 10.5
 */

describe('Security Middleware - Property Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(configureHelmet());
    app.use(enforceHttps);
    app.use(additionalSecurityHeaders);
    app.use(express.json());

    // Test endpoint
    app.get('/test', (_req, res) => {
      res.json({ message: 'test' });
    });

    app.post('/test', (_req, res) => {
      res.json({ message: 'test' });
    });
  });

  /**
   * Property 32: Security Header Presence
   * For any dashboard HTTP response, standard security headers
   * (HTTPS enforcement, CSRF tokens, XSS protection headers) should be present.
   */
  describe('Property 32: Security Header Presence', () => {
    it('should include helmet security headers in all responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('/test', '/test/path', '/api/test'),
          async (path) => {
            const response = await request(app).get(path);

            // Check for key security headers
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBeDefined();
            expect(response.headers['strict-transport-security']).toBeDefined();
            expect(response.headers['content-security-policy']).toBeDefined();

            // Verify X-Powered-By is hidden
            expect(response.headers['x-powered-by']).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include HSTS header with proper configuration', async () => {
      const response = await request(app).get('/test');

      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toBeDefined();
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should include Content Security Policy header', async () => {
      const response = await request(app).get('/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-src 'none'");
    });

    it('should include additional security headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['permissions-policy']).toBeDefined();
      expect(response.headers['x-download-options']).toBe('noopen');
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
      expect(response.headers['referrer-policy']).toBeDefined();
    });

    it('should include security headers for all HTTP methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('GET', 'POST'),
          async (method) => {
            const response =
              method === 'GET'
                ? await request(app).get('/test')
                : await request(app).post('/test').send({});

            // All responses should have security headers
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['strict-transport-security']).toBeDefined();

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should include security headers even for error responses', async () => {
      const response = await request(app).get('/nonexistent');

      // Even 404 responses should have security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    it('should generate unique CSRF tokens for different sessions', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 10, maxLength: 50 }), {
            minLength: 2,
            maxLength: 10,
          }),
          (sessionIds) => {
            const tokens = sessionIds.map((id) => CSRFProtection.generateToken(id));

            // All tokens should be unique
            const uniqueTokens = new Set(tokens);
            expect(uniqueTokens.size).toBe(tokens.length);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should validate correct CSRF tokens', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 10, maxLength: 50 }), (sessionId) => {
          const token = CSRFProtection.generateToken(sessionId);
          const isValid = CSRFProtection.validateToken(sessionId, token);

          expect(isValid).toBe(true);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    it('should reject invalid CSRF tokens', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.string({ minLength: 10, maxLength: 50 }),
          (sessionId, wrongToken) => {
            const correctToken = CSRFProtection.generateToken(sessionId);

            // Ensure wrongToken is different from correctToken
            if (wrongToken === correctToken) {
              return true; // Skip this case
            }

            const isValid = CSRFProtection.validateToken(sessionId, wrongToken);
            expect(isValid).toBe(false);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should reject tokens for non-existent sessions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.string({ minLength: 10, maxLength: 50 }),
          (sessionId, token) => {
            // Don't generate a token for this session
            const isValid = CSRFProtection.validateToken(sessionId, token);
            expect(isValid).toBe(false);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('HTTPS Enforcement', () => {
    it('should not redirect in development mode', async () => {
      // Set environment to development
      process.env.NODE_ENV = 'development';

      const response = await request(app).get('/test');

      // Should not redirect (status 200, not 301)
      expect(response.status).not.toBe(301);
    });
  });

  describe('XSS Protection', () => {
    it('should include XSS protection headers', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Clickjacking Protection', () => {
    it('should prevent clickjacking with X-Frame-Options', async () => {
      const response = await request(app).get('/test');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent framing with CSP frame-src', async () => {
      const response = await request(app).get('/test');

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("frame-src 'none'");
    });
  });
});
