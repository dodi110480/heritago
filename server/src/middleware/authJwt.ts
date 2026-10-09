import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const ACCESS_COOKIE = 'auth_token';
const REFRESH_COOKIE = 'refresh_token';

export const authJwt = (prisma: PrismaClient) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const token = (req as any).cookies?.[ACCESS_COOKIE];
        if (!token) return next();

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ success: false, message: 'JWT_SECRET not configured' });
        }

        try {
            const payload = jwt.verify(token, secret) as { id: string };
            const user = await prisma.user.findUnique({ where: { id: payload.id } });
            if (user && !user.isSuspended) {
                (req as any).user = user;
            }
            return next();
        } catch (error) {
            // If token is invalid or expired, we just don't set req.user
            // This prevents blocking the /login route when an old cookie exists
            return next();
        }
    };
};

export const getAuthCookieName = () => ACCESS_COOKIE;
export const getRefreshCookieName = () => REFRESH_COOKIE;

/**
 * Whether auth cookies are marked `Secure`.
 *
 * Browsers only store `Secure` cookies when the page is served over HTTPS, so a
 * plain-HTTP deployment (e.g. an internal test server) would silently lose the
 * session after login. Such a host opts out explicitly via `COOKIE_SECURE=false`;
 * without the variable the production default (secure) applies.
 */
export const isSecureCookie = (): boolean => {
    const explicit = process.env.COOKIE_SECURE;
    if (explicit !== undefined && explicit !== '') {
        return explicit.toLowerCase() === 'true';
    }
    return process.env.NODE_ENV === 'production';
};
