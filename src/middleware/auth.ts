/**
 * JWT Authentication Middleware for Research Agent MVP
 *
 * Security Features:
 * - Bearer token validation
 * - JWT signature verification
 * - 401 for missing token
 * - 403 for invalid/expired token
 * - Environment-based secret configuration
 *
 * Usage:
 *   import { authenticateJWT } from './middleware/auth';
 *   app.post('/query', authenticateJWT, handler);
 */

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

/**
 * JWT Authentication Middleware
 *
 * Validates Bearer tokens on protected endpoints.
 * Requires JWT_SECRET environment variable to be set.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @returns 401 if no token provided
 * @returns 403 if token is invalid or expired
 * @returns next() if token is valid
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Check for Authorization header
  if (!authHeader) {
    console.warn('[Auth] Request rejected: No Authorization header');
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'No token provided. Include Authorization: Bearer <token> header.'
    });
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.warn('[Auth] Request rejected: Invalid Authorization format');
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization format',
      message: 'Authorization header must be in format: Bearer <token>'
    });
  }

  const token = parts[1];
  const secret = process.env.JWT_SECRET;

  // Ensure JWT_SECRET is configured
  if (!secret) {
    console.error('[Auth] CRITICAL: JWT_SECRET not configured in environment');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error',
      message: 'JWT authentication not properly configured'
    });
  }

  try {
    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, secret);

    // Attach decoded token to request for downstream use
    (req as any).user = decoded;

    console.log('[Auth] Token validated successfully');
    next();

  } catch (err: any) {
    // Handle specific JWT errors
    if (err.name === 'TokenExpiredError') {
      console.warn('[Auth] Request rejected: Token expired');
      return res.status(403).json({
        success: false,
        error: 'Token expired',
        message: 'Your authentication token has expired. Please obtain a new token.'
      });
    }

    if (err.name === 'JsonWebTokenError') {
      console.warn('[Auth] Request rejected: Invalid token signature');
      return res.status(403).json({
        success: false,
        error: 'Invalid token',
        message: 'Token signature verification failed. Token may be malformed or tampered with.'
      });
    }

    // Generic error
    console.warn('[Auth] Request rejected: Token verification failed', err.message);
    return res.status(403).json({
      success: false,
      error: 'Token verification failed',
      message: err.message
    });
  }
}

/**
 * Optional: Generate JWT tokens (for testing or admin endpoints)
 *
 * @param payload - Data to encode in token (e.g., { userId: '123', role: 'admin' })
 * @param expiresIn - Token expiration (default: '24h')
 * @returns Signed JWT token
 *
 * Example:
 *   const token = generateToken({ service: 'claude-code', ip: req.ip }, '1h');
 */
export function generateToken(payload: object, expiresIn: string = '24h'): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

/**
 * Optional: Health check bypass for unauthenticated endpoints
 * Use this for /health and /debug endpoints that should remain public
 *
 * @param req - Express request object
 * @returns boolean - true if request is for public endpoint
 */
export function isPublicEndpoint(req: Request): boolean {
  const publicPaths = ['/health', '/debug', '/sse/stats'];
  return publicPaths.includes(req.path);
}
