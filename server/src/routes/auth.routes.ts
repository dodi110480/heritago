import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const authRoutes = (prisma: PrismaClient) => {
    const router = Router();

    router.post('/auth/login', async (req, res) => {
        const { username, password } = req.body;
        const user = await prisma.user.findUnique({ where: { username } });

        if (user && user.password === password) {
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.globalRole === 'ADMIN'
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    });

    router.post('/auth/register', async (req, res) => {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Alle Felder müssen ausgefüllt sein.' });
        }

        try {
            const existingUser = await prisma.user.findFirst({
                where: { OR: [{ username }, { email }] }
            });

            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Benutzername oder Email bereits vergeben.' });
            }

            const user = await prisma.user.create({
                data: {
                    username,
                    email,
                    password, // In production, hash this!
                    globalRole: 'USER'
                }
            });

            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: false
                }
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ success: false, message: 'Serverfehler bei der Registrierung.' });
        }
    });

    // Admin User Management
    router.get('/admin/users', async (req, res) => {
        // Basic auth check should be here, but for now we list all
        try {
            const users = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    globalRole: true,
                    createdAt: true,
                    _count: {
                        select: { permissions: { where: { level: 'OWNER' } } }
                    }
                }
            });
            res.json({ success: true, users });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Fehler beim Laden der Benutzer.' });
        }
    });

    router.delete('/admin/users/:id', async (req, res) => {
        try {
            await prisma.user.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Benutzer konnte nicht gelöscht werden.' });
        }
    });

    router.patch('/admin/users/:id/role', async (req, res) => {
        const { role } = req.body;
        try {
            await prisma.user.update({
                where: { id: req.params.id },
                data: { globalRole: role }
            });
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Rolle konnte nicht aktualisiert werden.' });
        }
    });

    return router;
};
