import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

/**
 * Custom rate limiter factory function.
 */
export const createRateLimiter = (options: RateLimiterOptions = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // Default: 15 minutes
  const max = options.max !== undefined ? options.max : 200;
  const message = options.message || 'Too many requests to DataLens API, please try again later.';

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: (req, res) => {
      res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message,
      });
    },
  });
};

/**
 * Authentication Rate Limiter (stricter limit for brute-force protection)
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 15,
  message: 'Too many authentication attempts, please try again later.',
});

/**
 * AI Interpretation Rate Limiter (stricter limit for LLM/API usage protection)
 */
export const aiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 20,
  message: 'Too many AI interpretation requests, please try again later.',
});

/**
 * General API Rate Limiter
 */
export const generalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 5000 : 200,
  message: 'Too many requests to DataLens API, please try again later.',
});
