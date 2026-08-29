const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication endpoints (login and register).
 * Max 10 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiter for password reset requests to prevent email spam.
 * Max 3 requests per 15 minutes per IP.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: { error: 'Too many password reset requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  passwordResetLimiter,
};
