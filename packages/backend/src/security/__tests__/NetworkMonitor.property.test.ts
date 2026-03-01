import fc from 'fast-check';
import { NetworkMonitor } from '../NetworkMonitor';

/**
 * Property-Based Tests for NetworkMonitor
 * Feature: sustainoss
 * Property 30: Local Data Storage
 * Validates: Requirements 10.1, 10.3
 */

describe('NetworkMonitor - Property Tests', () => {
  beforeEach(() => {
    // Clear history before each test
    NetworkMonitor.clearHistory();
  });

  /**
   * Property 30: Local Data Storage
   * For any repository analysis operation, no network requests should be made
   * to external services (excluding the Git repository itself).
   */
  describe('Property 30: Local Data Storage', () => {
    it('should allow requests only to Git platforms (GitHub, GitLab)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('https://api.github.com/repos/owner/repo'),
            fc.constant('https://github.com/owner/repo'),
            fc.constant('https://gitlab.com/owner/repo'),
            fc.constant('https://gitlab.com/api/v4/projects/123')
          ),
          (url) => {
            const allowed = NetworkMonitor.logRequest(url, 'GET');
            expect(allowed).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should block requests to external services', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('https://example.com/api'),
            fc.constant('https://analytics.google.com/track'),
            fc.constant('https://api.external-service.com/data'),
            fc.constant('https://tracking.example.com/event'),
            fc.constant('https://cdn.example.com/script.js')
          ),
          (url) => {
            const allowed = NetworkMonitor.logRequest(url, 'GET');
            expect(allowed).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow localhost requests for development', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('http://localhost:3000/api'),
            fc.constant('http://127.0.0.1:5432/db'),
            fc.constant('https://localhost:8080/test')
          ),
          (url) => {
            const allowed = NetworkMonitor.logRequest(url, 'GET');
            expect(allowed).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should log all network requests', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.webUrl(),
              method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (requests) => {
            NetworkMonitor.clearHistory();

            requests.forEach((req) => {
              NetworkMonitor.logRequest(req.url, req.method);
            });

            const logged = NetworkMonitor.getRequests();
            expect(logged.length).toBe(requests.length);

            // Verify each request was logged
            requests.forEach((req, index) => {
              expect(logged[index].url).toBe(req.url);
              expect(logged[index].method).toBe(req.method);
              expect(logged[index].timestamp).toBeInstanceOf(Date);
              expect(typeof logged[index].allowed).toBe('boolean');
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should track blocked requests separately', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.oneof(
                fc.constant('https://github.com/test'),
                fc.constant('https://external.com/api')
              ),
              method: fc.constantFrom('GET', 'POST'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (requests) => {
            NetworkMonitor.clearHistory();

            requests.forEach((req) => {
              NetworkMonitor.logRequest(req.url, req.method);
            });

            const blocked = NetworkMonitor.getBlockedRequests();
            const expectedBlocked = requests.filter((req) =>
              req.url.includes('external.com')
            );

            expect(blocked.length).toBe(expectedBlocked.length);

            blocked.forEach((req) => {
              expect(req.allowed).toBe(false);
              expect(req.reason).toBeDefined();
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle subdomain variations correctly', () => {
      const testCases = [
        { url: 'https://api.github.com/test', expected: true },
        { url: 'https://raw.githubusercontent.com/test', expected: false }, // Not in allowed list
        { url: 'https://gitlab.example.com/test', expected: false }, // Not gitlab.com
        { url: 'https://github.com.evil.com/test', expected: false }, // Fake domain
      ];

      testCases.forEach(({ url, expected }) => {
        const allowed = NetworkMonitor.isAllowedUrl(url);
        expect(allowed).toBe(expected);
      });
    });

    it('should allow adding custom allowed domains', () => {
      fc.assert(
        fc.property(fc.domain(), (domain) => {
          NetworkMonitor.addAllowedDomain(domain);

          const allowedDomains = NetworkMonitor.getAllowedDomains();
          expect(allowedDomains).toContain(domain);

          const url = `https://${domain}/api/test`;
          const allowed = NetworkMonitor.isAllowedUrl(url);
          expect(allowed).toBe(true);

          return true;
        }),
        { numRuns: 50 }
      );
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        '',
        'javascript:alert(1)',
        '//no-protocol.com',
      ];

      invalidUrls.forEach((url) => {
        const allowed = NetworkMonitor.isAllowedUrl(url);
        expect(allowed).toBe(false);
      });
    });

    it('should provide request history for auditing', () => {
      fc.assert(
        fc.property(
          fc.array(fc.webUrl(), { minLength: 1, maxLength: 20 }),
          (urls) => {
            NetworkMonitor.clearHistory();

            urls.forEach((url) => {
              NetworkMonitor.logRequest(url, 'GET');
            });

            const history = NetworkMonitor.getRequests();
            expect(history.length).toBe(urls.length);

            // Verify history is immutable (returns a copy)
            history.push({
              url: 'https://test.com',
              method: 'GET',
              timestamp: new Date(),
              allowed: true,
            });

            const historyAgain = NetworkMonitor.getRequests();
            expect(historyAgain.length).toBe(urls.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('NetworkMonitor - Additional Tests', () => {
    it('should clear history when requested', () => {
      NetworkMonitor.logRequest('https://github.com/test', 'GET');
      NetworkMonitor.logRequest('https://gitlab.com/test', 'GET');

      expect(NetworkMonitor.getRequests().length).toBe(2);

      NetworkMonitor.clearHistory();

      expect(NetworkMonitor.getRequests().length).toBe(0);
    });

    it('should not duplicate allowed domains', () => {
      const initialCount = NetworkMonitor.getAllowedDomains().length;

      NetworkMonitor.addAllowedDomain('test.com');
      expect(NetworkMonitor.getAllowedDomains().length).toBe(initialCount + 1);

      NetworkMonitor.addAllowedDomain('test.com');
      expect(NetworkMonitor.getAllowedDomains().length).toBe(initialCount + 1);
    });
  });
});
