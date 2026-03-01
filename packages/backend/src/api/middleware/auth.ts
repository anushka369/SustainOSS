import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env.js';

/**
 * API key authentication middleware
 * Validates the X-API-Key header against the configured API key
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    res.status(401).json({
      error: 'Missing API key',
      details: 'X-API-Key header is required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (apiKey !== config.apiKey) {
    res.status(401).json({
      error: 'Invalid API key',
      details: 'The provided API key is not valid',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}
