import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login, register, verify, reset).
 * Configurable via environment variables; defaults are conservative.
 */
export const authRateLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 20,
    standardHeaders: true,
    handler: (_req, res) => {
        res.status(429).json({
            success: false,
            message: 'Zu viele Anfragen. Bitte versuche es später erneut.',
            code: 'RATE_LIMITED'
        });
    }
});
