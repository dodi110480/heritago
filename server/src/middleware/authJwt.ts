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
            if (user) {
                (req as any).user = user;
            }
            return next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }
    };
};

export const getAuthCookieName = () => ACCESS_COOKIE;
export const getRefreshCookieName = () => REFRESH_COOKIE;
