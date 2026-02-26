import pino from 'pino';

/**
 * Structured logger — pino.
 *
 * SECURITY RULES (enforced here):
 * - Never log session_token_encrypted or session_token_iv
 * - Never log Instagram sessionid cookie values
 * - Redact any field matching these names before output
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'session_token_encrypted',
      'session_token_iv',
      'sessionid',
      'sessionToken',
      'session_token',
      '*.session_token_encrypted',
      '*.session_token_iv',
      '*.sessionid',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : {}),
});

export type Logger = typeof logger;
