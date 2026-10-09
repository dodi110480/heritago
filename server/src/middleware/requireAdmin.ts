import { PrismaClient } from '@prisma/client';

/**
 * Middleware that guarantees the authenticated user has the global ADMIN role.
 * Must run after authJwt/devAuth so that `req.user` is populated.
 * Uses `any` request types to stay compatible with the untyped route handlers
 * in auth.routes.ts (same convention as the local `requireAdmin` before).
 */
export const requireAdmin = (prisma: PrismaClient) => {
    return async (req: any, res: any, next: any) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
            }
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.globalRole !== 'ADMIN') {
                return res.status(403).json({ success: false, message: 'Admin privileges required', code: 'ADMIN_REQUIRED' });
            }
            return next();
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message || 'Authorization failed', code: 'AUTHZ_FAILED' });
        }
    };
};
