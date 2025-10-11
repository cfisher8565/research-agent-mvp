/**
 * Rate Limiting Middleware for Research Agent MVP
 *
 * Security Features:
 * - 100 requests per minute per IP
 * - Standard headers (RateLimit-* headers)
 * - Configurable via environment variables
 * - Custom error messages
 *
 * Usage:
 *   import { limiter } from './middleware/rate-limit';
 *   app.use('/query', limiter);
 */

import rateLimit from 'express-rate-limit';

/**
 * Primary rate limiter for query endpoints
 *
 * Limits: 100 requests per minute per IP address
 * Headers: Sends standardized RateLimit-* headers
 *
 * Environment Variables:
 * - RATE_LIMIT_WINDOW_MS: Time window in milliseconds (default: 60000)
 * - RATE_LIMIT_MAX: Maximum requests per window (default: 100)
 */
export const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: 60 // seconds
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers

  // Skip rate limiting for certain conditions (optional)
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },

  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    console.warn('[RateLimit] Request rejected from IP:', req.ip);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the rate limit of 100 requests per minute. Please try again later.',
      retryAfter: 60
    });
  }
});

/**
 * Stricter rate limiter for sensitive endpoints (e.g., admin, token generation)
 *
 * Limits: 10 requests per minute per IP address
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded for this endpoint. Please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn('[RateLimit:Strict] Request rejected from IP:', req.ip);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'You have exceeded the strict rate limit of 10 requests per minute for this endpoint.',
      retryAfter: 60
    });
  }
});

/**
 * Development/lenient rate limiter (for testing environments)
 *
 * Limits: 1000 requests per minute per IP address
 */
export const devLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false
});
