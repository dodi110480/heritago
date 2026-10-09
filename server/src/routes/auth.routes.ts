import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import jwt from 'jsonwebtoken';
import { getAuthCookieName, getRefreshCookieName, isSecureCookie } from '../middleware/authJwt';
import { authRateLimiter } from '../middleware/rateLimit';
import { requireAdmin as requireAdminMiddleware } from '../middleware/requireAdmin';

export const authRoutes = (prisma: PrismaClient) => {
    const router = Router();
    const authService = new AuthService(prisma);

    const requireAuth = async (req: any, res: any, next: any) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        }
        return next();
    };

    const requireAdmin = requireAdminMiddleware(prisma);

    router.post('/login', authRateLimiter, async (req, res) => {
        try {
            const { username, password } = req.body;
            const result = await authService.validateUser(username, password);

            if (!result) {
                return res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten.', code: 'AUTH_INVALID_CREDENTIALS' });
            }

            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ success: false, message: 'JWT_SECRET not configured', code: 'AUTH_CONFIG_MISSING' });
            }
            const accessToken = jwt.sign({ id: result.id, type: 'access' }, secret, { expiresIn: '1h' });
            const refreshToken = jwt.sign({ id: result.id, type: 'refresh' }, secret, { expiresIn: '7d' });
            res.cookie(getAuthCookieName(), accessToken, {
                httpOnly: true,
                secure: isSecureCookie(),
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000
            });
            res.cookie(getRefreshCookieName(), refreshToken, {
                httpOnly: true,
                secure: isSecureCookie(),
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            res.json({ success: true, data: result });
        } catch (error: any) {
            const status = error.statusCode || 500;
            res.status(status).json({ success: false, message: error.message, code: error.code || 'AUTH_LOGIN_FAILED' });
        }
    });

    router.post('/register', authRateLimiter, async (req, res) => {
        try {
            const { username, email, password, website } = req.body;
            // Honeypot: bots fill hidden fields; reject silently.
            if (website) {
                return res.status(400).json({ success: false, message: 'Registrierung fehlgeschlagen.', code: 'AUTH_REGISTER_FAILED' });
            }
            if (!username || !email || !password) {
                return res.status(400).json({ success: false, message: 'Alle Felder müssen ausgefüllt sein.', code: 'VALIDATION_ERROR' });
            }

            const result = await authService.registerUser({ username, email, password });
            res.json({ success: true, data: { ...result, message: 'Bitte verifiziere deine E-Mail-Adresse (Link wurde gesendet).' } });
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

            const accessToken = jwt.sign({ id: user.id, type: 'access' }, secret, { expiresIn: '1h' });
            res.cookie(getAuthCookieName(), accessToken, {
                httpOnly: true,
                secure: isSecureCookie(),
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000
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
            const status = error.statusCode || 400;
            res.status(status).json({
                success: false,
                message: error.message || 'Benutzer konnte nicht gelöscht werden.',
                code: error.code || 'ADMIN_USER_DELETE_FAILED'
            });
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

    router.patch('/users/:id/suspend', requireAdmin, async (req, res) => {
        try {
            const { suspended } = req.body;
            await authService.setUserSuspended(req.params.id, !!suspended);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: 'Sperrstatus konnte nicht aktualisiert werden.', code: 'ADMIN_USER_SUSPEND_FAILED' });
        }
    });

    router.patch('/users/:id/max-trees', requireAdmin, async (req, res) => {
        try {
            const { maxTrees } = req.body;
            if (!Number.isInteger(maxTrees) || maxTrees < 0) {
                return res.status(400).json({ success: false, message: 'Ungültiger Wert für maxTrees.', code: 'VALIDATION_ERROR' });
            }
            await authService.setUserMaxTrees(req.params.id, maxTrees);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: 'Baum-Limit konnte nicht aktualisiert werden.', code: 'ADMIN_USER_MAXTREES_FAILED' });
        }
    });

    router.post('/verify-email', authRateLimiter, async (req, res) => {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(400).json({ success: false, message: 'Token fehlt.', code: 'VALIDATION_ERROR' });
            }
            const ok = await authService.verifyEmail(token);
            if (!ok) {
                return res.status(400).json({ success: false, message: 'Ungültiger oder abgelaufener Verifizierungslink.', code: 'AUTH_VERIFY_INVALID' });
            }
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'AUTH_VERIFY_FAILED' });
        }
    });

    router.post('/forgot-password', authRateLimiter, async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ success: false, message: 'E-Mail fehlt.', code: 'VALIDATION_ERROR' });
            }
            await authService.forgotPassword(email);
            // Generic response (no user enumeration).
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'AUTH_FORGOT_FAILED' });
        }
    });

    router.post('/reset-password', authRateLimiter, async (req, res) => {
        try {
            const { token, password } = req.body;
            if (!token || !password) {
                return res.status(400).json({ success: false, message: 'Token und Passwort erforderlich.', code: 'VALIDATION_ERROR' });
            }
            const ok = await authService.resetPassword(token, password);
            if (!ok) {
                return res.status(400).json({ success: false, message: 'Ungültiger oder abgelaufener Reset-Link.', code: 'AUTH_RESET_INVALID' });
            }
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message, code: 'AUTH_RESET_FAILED' });
        }
    });

    return router;
};
