/**
 * WINSTON STRUCTURED LOGGING WITH DAILY ROTATION
 * ================================================
 * Production-grade logging with JSON format and automatic rotation
 *
 * Features:
 * - JSON structured logs for easy parsing
 * - Daily rotation with date-based filenames
 * - Separate error log files
 * - 14-day retention for application logs
 * - 30-day retention for error logs
 * - Console output with colors for development
 * - Request ID tracing support
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, service, requestId, ...meta }) => {
    let msg = `${timestamp} [${service || 'research-agent'}] ${level}: ${message}`;

    if (requestId) {
      msg += ` [reqId=${requestId}]`;
    }

    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }

    return msg;
  })
);

// Application logs (info, warn, debug) - 14-day retention
const applicationTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '100m',
  maxFiles: '14d',
  level: 'info',
  format: customFormat
});

// Error logs only - 30-day retention
const errorTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '100m',
  maxFiles: '30d',
  level: 'error',
  format: customFormat
});

// Console transport for development
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'research-agent',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    applicationTransport,
    errorTransport,
    consoleTransport
  ],
  // Don't exit on handled exceptions
  exitOnError: false
});

// Log rotation events
applicationTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Application log rotated', { oldFilename, newFilename });
});

errorTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Error log rotated', { oldFilename, newFilename });
});

// Child logger with request ID
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

// Express middleware for request logging
export function requestLoggingMiddleware(req: any, res: any, next: any) {
  const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  req.logger = createRequestLogger(requestId);

  const startTime = Date.now();

  // Log request
  req.logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    });
  });

  next();
}

// Structured logging helpers
export const log = {
  info: (message: string, meta?: Record<string, any>) => logger.info(message, meta),
  error: (message: string, error?: Error | Record<string, any>) => {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack });
    } else {
      logger.error(message, error);
    }
  },
  warn: (message: string, meta?: Record<string, any>) => logger.warn(message, meta),
  debug: (message: string, meta?: Record<string, any>) => logger.debug(message, meta),

  // Agent-specific log methods
  agentQuery: (sessionId: string, prompt: string, duration: number) => {
    logger.info('Agent query completed', { sessionId, promptLength: prompt.length, duration });
  },

  toolExecution: (toolName: string, duration: number, success: boolean) => {
    logger.info('Tool execution', { toolName, duration, success });
  },

  cacheHit: (tokens: number, savings: number) => {
    logger.info('Cache hit', { tokens, savings });
  },

  sessionCreated: (sessionId: string, context?: Record<string, any>) => {
    logger.info('Session created', { sessionId, contextKeys: context ? Object.keys(context) : [] });
  },

  sessionClosed: (sessionId: string, messageCount: number, totalDuration: number) => {
    logger.info('Session closed', { sessionId, messageCount, totalDuration });
  }
};

export default logger;
