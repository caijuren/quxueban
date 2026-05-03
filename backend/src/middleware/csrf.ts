import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Store CSRF tokens in memory (for development)
// In production, use a distributed store like Redis
const csrfTokens = new Map<string, string>();

/**
 * Generate a CSRF token for the current session
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to generate and set CSRF token
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Generate CSRF token
  const token = generateCsrfToken();
  
  // Store token in memory with user session ID or IP
  const sessionKey = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
  csrfTokens.set(sessionKey, token);
  
  // Set CSRF token in response header
  res.setHeader('X-CSRF-Token', token);
  
  next();
}

/**
 * Middleware to validate CSRF token
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Get CSRF token from request header
  const token = req.headers['x-csrf-token'] as string;
  
  // Get session key (user session ID or IP)
  const sessionKey = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
  
  // Get stored token
  const storedToken = csrfTokens.get(sessionKey);
  
  // Validate token
  if (!token || !storedToken || token !== storedToken) {
    res.status(403).json({
      status: 'error',
      message: 'CSRF token validation failed'
    });
    return;
  }
  
  next();
}
