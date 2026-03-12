import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import jwt from 'jsonwebtoken';
import { getAuthCookieName, getRefreshCookieName } from '../middleware/authJwt';

export const authRoutes = (prisma: PrismaClient) => {
    const router = Router();
    const authService = new AuthService(prisma);

    const requireAuth = async (req: any, res: any, next: any) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }
        return next();
    };

    const requireAdmin = async (req: any, res: any, next: any) => {
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

    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const result = await authService.validateUser(username, password);

            if (result) {
                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    return res.status(500).json({ success: false, message: 'JWT_SECRET not configured', code: 'AUTH_CONFIG_MISSING' });
                }
                const accessToken = jwt.sign({ id: result.id, type: 'access' }, secret, { expiresIn: '15m' });
                const refreshToken = jwt.sign({ id: result.id, type: 'refresh' }, secret, { expiresIn: '7d' });
                res.cookie(getAuthCookieName(), accessToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 15 * 60 * 1000
                });
                res.cookie(getRefreshCookieName(), refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });
                res.json({ success: true, data: result });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials', code: 'AUTH_INVALID_CREDENTIALS' });
            }
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'AUTH_LOGIN_FAILED' });
        }
    });

    router.post('/register', async (req, res) => {
        try {
            const { username, email, password } = req.body;
            if (!username || !email || !password) {
                return res.status(400).json({ success: false, message: 'Alle Felder müssen ausgefüllt sein.', code: 'VALIDATION_ERROR' });
            }

            const result = await authService.registerUser({ username, email, password });
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ success: false, message: 'JWT_SECRET not configured', code: 'AUTH_CONFIG_MISSING' });
            }
            const accessToken = jwt.sign({ id: result.id, type: 'access' }, secret, { expiresIn: '15m' });
            const refreshToken = jwt.sign({ id: result.id, type: 'refresh' }, secret, { expiresIn: '7d' });
            res.cookie(getAuthCookieName(), accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000
            });
            res.cookie(getRefreshCookieName(), refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Registration error:', error);
            res.status(400).json({ success: false, message: error.message, code: 'AUTH_REGISTER_FAILED' });
        }
    });

    router.post('/refresh', async (req, res) => {
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ success: false, message: 'JWT_SECRET not configured', code: 'AUTH_CONFIG_MISSING' });
            }
            const refreshToken = (req as any).cookies?.[getRefreshCookieName()];
            if (!refreshToken) {
                return res.status(401).json({ success: false, message: 'Refresh token missing', code: 'AUTH_REFRESH_MISSING' });
            }

            const payload = jwt.verify(refreshToken, secret) as { id: string; type?: string };
            if (payload.type !== 'refresh') {
                return res.status(401).json({ success: false, message: 'Invalid refresh token', code: 'AUTH_REFRESH_INVALID' });
            }

            const user = await prisma.user.findUnique({ where: { id: payload.id } });
            if (!user) return res.status(401).json({ success: false, message: 'User not found', code: 'AUTH_USER_NOT_FOUND' });

            const accessToken = jwt.sign({ id: user.id, type: 'access' }, secret, { expiresIn: '15m' });
            res.cookie(getAuthCookieName(), accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000
            });
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(401).json({ success: false, message: 'Invalid or expired refresh token', code: 'AUTH_REFRESH_INVALID' });
        }
    });

    router.post('/logout', async (req, res) => {
        res.clearCookie(getAuthCookieName());
        res.clearCookie(getRefreshCookieName());
        res.json({ success: true, data: null });
    });

    router.get('/me', requireAuth, async (req: any, res) => {
        const user = req.user;
        res.json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                email: user.email,
                globalRole: user.globalRole,
                isAdmin: user.globalRole === 'ADMIN'
            }
        });
    });

    // Admin User Management
    router.get('/users', requireAdmin, async (req, res) => {
        try {
            const users = await authService.getUsers();
            res.json({ success: true, data: users });
        } catch (error: any) {
            res.status(500).json({ success: false, message: 'Fehler beim Laden der Benutzer.', code: 'ADMIN_USERS_FETCH_FAILED' });
        }
    });

    router.delete('/users/:id', requireAdmin, async (req, res) => {
        try {
            await authService.deleteUser(req.params.id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: 'Benutzer konnte nicht gelöscht werden.', code: 'ADMIN_USER_DELETE_FAILED' });
        }
    });

    router.patch('/users/:id/role', requireAdmin, async (req, res) => {
        try {
            const { role } = req.body;
            await authService.updateUserRole(req.params.id, role);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: 'Rolle konnte nicht aktualisiert werden.', code: 'ADMIN_USER_ROLE_FAILED' });
        }
    });

    return router;
};
