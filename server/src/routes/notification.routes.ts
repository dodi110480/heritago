import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/notification.service';

export const notificationRoutes = (prisma: PrismaClient) => {
    const router = Router();
    const notificationService = new NotificationService(prisma);

    router.use((req: any, res: any, next: any) => {
        if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        return next();
    });

    router.get('/', async (req: any, res) => {
        try {
            const [notifications, unread] = await Promise.all([
                notificationService.listForUser(req.user.id),
                notificationService.unreadCount(req.user.id)
            ]);
            res.json({ success: true, data: { notifications, unread } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'NOTIFICATIONS_FAILED' });
        }
    });

    router.post('/:id/read', async (req: any, res) => {
        await notificationService.markRead(req.user.id, req.params.id);
        res.json({ success: true, data: null });
    });

    router.post('/read-all', async (req: any, res) => {
        await notificationService.markAllRead(req.user.id);
        res.json({ success: true, data: null });
    });

    return router;
};
