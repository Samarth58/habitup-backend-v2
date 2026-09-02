const rateLimit = require('express-rate-limit');

const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;
const PASSWORD_RESET_RATE_LIMIT_MAX = Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX) || 3;
const HEARTBEAT_RATE_LIMIT_MAX = Number(process.env.HEARTBEAT_RATE_LIMIT_MAX) || 60;

/**
 * Rate limiter for authentication endpoints (login and register).
 * Defaults to 10 requests per 15 minutes per IP to preserve production behavior.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: AUTH_RATE_LIMIT_MAX,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for password reset requests to prevent email spam.
 * Defaults to 3 requests per 15 minutes per IP to preserve production behavior.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: PASSWORD_RESET_RATE_LIMIT_MAX,
  message: { error: 'Too many password reset requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const heartbeatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: HEARTBEAT_RATE_LIMIT_MAX,
  message: { error: 'Too many heartbeat requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  passwordResetLimiter,
  heartbeatLimiter,
};
