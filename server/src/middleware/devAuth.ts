import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Development-only auth helper.
 * In production, explicit auth (JWT/session) should be used instead.
 */
export const devAuth = (prisma: PrismaClient) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if ((req as any).user) return next();
        const userIdHeader = req.headers['x-user-id'];
        const userId = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;

        if (!userId) return next();

        if (process.env.NODE_ENV === 'production') {
            return res.status(401).json({ success: false, message: 'Auth required' });
        }

        try {
            const user = await prisma.user.findUnique({ where: { id: userId as string } });
            if (user) {
                (req as any).user = user;
            }
            return next();
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message || 'Auth lookup failed' });
        }
    };
};
