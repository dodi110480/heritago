import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ChangeRequestService } from '../services/change-request.service';

export const changeRequestRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const changeRequestService = new ChangeRequestService(prisma);

    const requireOwner = (req: any, res: any, next: any) => {
        if ((req as any).permission !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Nur der Besitzer kann Änderungen bestätigen.', code: 'CHANGE_OWNER_ONLY' });
        }
        return next();
    };

    router.get('/', requireOwner, async (req: any, res) => {
        try {
            const list = await changeRequestService.listForOwner(req.tree.id);
            res.json({ success: true, data: list });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'CHANGE_LIST_FAILED' });
        }
    });

    router.post('/:id/approve', requireOwner, async (req: any, res) => {
        try {
            await changeRequestService.approve(req.tree.id, req.params.id, req.user.id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message, code: 'CHANGE_APPROVE_FAILED' });
        }
    });

    router.post('/:id/reject', requireOwner, async (req: any, res) => {
        try {
            await changeRequestService.reject(req.tree.id, req.params.id, req.user.id, req.body?.reason);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message, code: 'CHANGE_REJECT_FAILED' });
        }
    });

    router.delete('/:id', async (req: any, res) => {
        // Only the author can cancel their own pending change (within the tree).
        try {
            await changeRequestService.cancel(req.tree.id, req.params.id, req.user.id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message, code: 'CHANGE_CANCEL_FAILED' });
        }
    });

    return router;
};
