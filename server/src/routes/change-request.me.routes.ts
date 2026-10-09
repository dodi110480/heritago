import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ChangeRequestService } from '../services/change-request.service';

export const myChangeRequestRoutes = (prisma: PrismaClient) => {
    const router = Router();
    const changeRequestService = new ChangeRequestService(prisma);

    router.use((req: any, res: any, next: any) => {
        if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
        return next();
    });

    router.get('/', async (req: any, res) => {
        const list = await changeRequestService.listRelevant(req.user.id);
        res.json({ success: true, data: list });
    });

    router.get('/:id', async (req: any, res) => {
        const cr = await changeRequestService.getChangeRequest(req.params.id, req.user.id);
        if (!cr) return res.status(404).json({ success: false, message: 'Änderungsantrag nicht gefunden.', code: 'CHANGE_NOT_FOUND' });
        res.json({ success: true, data: cr });
    });

    router.post('/:id/messages', async (req: any, res) => {
        try {
            const { body } = req.body;
            if (!body || !body.trim()) {
                return res.status(400).json({ success: false, message: 'Nachricht darf nicht leer sein.', code: 'VALIDATION_ERROR' });
            }
            await changeRequestService.addMessage(req.params.id, req.user.id, body);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message, code: 'CHANGE_MESSAGE_FAILED' });
        }
    });

    router.delete('/:id', async (req: any, res) => {
        try {
            await changeRequestService.cancelById(req.params.id, req.user.id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message, code: 'CHANGE_CANCEL_FAILED' });
        }
    });

    return router;
};
