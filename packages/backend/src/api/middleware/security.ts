import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from '../../config/env.js';

/**
 * Security middleware configuration
 * Requirements: 10.5
 */

/**
 * Configure helmet with comprehensive security headers
 */
export function configureHelmet() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // Strict Transport Security (HTTPS enforcement)
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // X-Frame-Options
    frameguard: {
      action: 'deny',
    },
    // X-Content-Type-Options
    noSniff: true,
    // X-XSS-Protection
    xssFilter: true,
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    // Hide X-Powered-By header
    hidePoweredBy: true,
  });
}

/**
 * HTTPS enforcement middleware
 * Redirects HTTP requests to HTTPS in production
 */
export function enforceHttps(req: Request, res: Response, next: NextFunction): void {
  // Skip in development or if HTTPS is not enabled
  if (config.env === 'development' || !config.security.enableHttps) {
    return next();
  }

  // Check if request is already HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }

  // Redirect to HTTPS
  const httpsUrl = `https://${req.hostname}${req.url}`;
  res.redirect(301, httpsUrl);
}

/**
 * Simple CSRF protection middleware
 * Validates CSRF token for state-changing operations
 */
export class CSRFProtection {
  private static tokens = new Map<string, { token: string; expires: number }>();
  private static readonly TOKEN_EXPIRY = 3600000; // 1 hour

  /**
   * Generate a CSRF token for a session
   */
  static generateToken(sessionId: string): string {
    const token = this.randomToken();
    const expires = Date.now() + this.TOKEN_EXPIRY;
    this.tokens.set(sessionId, { token, expires });
    return token;
  }

  /**
   * Validate a CSRF token
   */
  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    if (!stored) {
      return false;
    }

    // Check if token is expired
    if (Date.now() > stored.expires) {
      this.tokens.delete(sessionId);
      return false;
    }

    return stored.token === token;
  }

  /**
   * Middleware to validate CSRF token for state-changing operations
   */
  static middleware(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Get session ID from API key (simplified for this implementation)
    const apiKey = req.header('X-API-Key');
    if (!apiKey) {
      res.status(401).json({
        error: 'Missing API key',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Get CSRF token from header
    const csrfToken = req.header('X-CSRF-Token');
    if (!csrfToken) {
      res.status(403).json({
        error: 'Missing CSRF token',
        details: 'X-CSRF-Token header is required for state-changing operations',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate token
    if (!CSRFProtection.validateToken(apiKey, csrfToken)) {
      res.status(403).json({
        error: 'Invalid CSRF token',
        details: 'The provided CSRF token is invalid or expired',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }

  /**
   * Generate a random token
   */
  private static randomToken(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Clean up expired tokens
   */
  static cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens.entries()) {
      if (now > data.expires) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

// Run cleanup every 10 minutes
setInterval(() => {
  CSRFProtection.cleanupExpiredTokens();
}, 600000);

/**
 * Additional security headers middleware
 */
export function additionalSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  // X-Download-Options
  res.setHeader('X-Download-Options', 'noopen');

  // X-Permitted-Cross-Domain-Policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  next();
}
