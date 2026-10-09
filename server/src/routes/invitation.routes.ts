import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { InvitationService } from '../services/invitation.service';

export const invitationRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const invitationService = new InvitationService(prisma);

    const requireOwner = (req: any, res: any, next: any) => {
        if ((req as any).permission !== 'OWNER') {
            return res.status(403).json({ success: false, message: 'Nur der Besitzer kann Einladungen verwalten.', code: 'INVITE_OWNER_ONLY' });
        }
        return next();
    };

    router.get('/', requireOwner, async (req: any, res) => {
        try {
            const invitations = await invitationService.listInvitations(req.tree.id);
            res.json({ success: true, data: invitations });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'INVITE_LIST_FAILED' });
        }
    });

    router.post('/', requireOwner, async (req: any, res) => {
        try {
            const { email, level } = req.body;
            const invitation = await invitationService.invite(req.tree.id, email, level, req.user?.id);
            res.json({ success: true, data: { id: invitation.id, email: invitation.email, level: invitation.level, expiresAt: invitation.expiresAt } });
        } catch (error: any) {
            const status = error.statusCode || 500;
            res.status(status).json({
                success: false,
                message: error.message,
                code: status === 409 ? 'INVITE_CONFLICT' : (status === 400 ? 'INVITE_VALIDATION' : 'INVITE_FAILED')
            });
        }
    });

    router.delete('/:id', requireOwner, async (req: any, res) => {
        try {
            await invitationService.revokeInvitation(req.tree.id, req.params.id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(error.statusCode || 500).json({ success: false, message: error.message, code: 'INVITE_REVOKE_FAILED' });
        }
    });

    return router;
};
