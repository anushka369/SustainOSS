/**
 * Network monitoring service for privacy compliance
 * Ensures no external API calls except to Git platforms
 * Requirements: 10.1, 10.3
 */

export interface NetworkRequest {
  url: string;
  method: string;
  timestamp: Date;
  allowed: boolean;
  reason?: string;
}

export class NetworkMonitor {
  private static requests: NetworkRequest[] = [];
  private static allowedDomains = [
    'github.com',
    'api.github.com',
    'gitlab.com',
    'localhost',
    '127.0.0.1',
  ];

  /**
   * Log a network request
   * @param url - The URL being accessed
   * @param method - The HTTP method
   * @returns Whether the request is allowed
   */
  static logRequest(url: string, method: string = 'GET'): boolean {
    const allowed = this.isAllowedUrl(url);
    const request: NetworkRequest = {
      url,
      method,
      timestamp: new Date(),
      allowed,
      reason: allowed ? undefined : 'Domain not in allowed list',
    };

    this.requests.push(request);

    // Log to console for monitoring
    if (allowed) {
      console.log(`[NetworkMonitor] Allowed request: ${method} ${url}`);
    } else {
      console.warn(`[NetworkMonitor] BLOCKED request: ${method} ${url}`);
    }

    return allowed;
  }

  /**
   * Check if a URL is allowed
   * @param url - The URL to check
   * @returns Whether the URL is allowed
   */
  static isAllowedUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check if hostname matches any allowed domain
      return this.allowedDomains.some((domain) => {
        return hostname === domain || hostname.endsWith(`.${domain}`);
      });
    } catch (error) {
      // Invalid URL
      return false;
    }
  }

  /**
   * Add an allowed domain
   * @param domain - The domain to allow (e.g., 'example.com')
   */
  static addAllowedDomain(domain: string): void {
    if (!this.allowedDomains.includes(domain)) {
      this.allowedDomains.push(domain);
      console.log(`[NetworkMonitor] Added allowed domain: ${domain}`);
    }
  }

  /**
   * Get all logged requests
   * @returns Array of network requests
   */
  static getRequests(): NetworkRequest[] {
    return [...this.requests];
  }

  /**
   * Get only blocked requests
   * @returns Array of blocked network requests
   */
  static getBlockedRequests(): NetworkRequest[] {
    return this.requests.filter((req) => !req.allowed);
  }

  /**
   * Clear request history
   */
  static clearHistory(): void {
    this.requests = [];
  }

  /**
   * Get allowed domains list
   * @returns Array of allowed domains
   */
  static getAllowedDomains(): string[] {
    return [...this.allowedDomains];
  }
}
