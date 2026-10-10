import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { FamilyReadService } from '../services/family/family.read.service';
import { FamilyWriteService } from '../services/family/family.write.service';
import { FamilyRepository } from '../repositories/family.repository';
import { AuditService } from '../services/audit.service';
import { ChangeRequestService } from '../services/change-request.service';

export const familyRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    
    // Manual DI
    const familyRepo = new FamilyRepository(prisma);
    const auditService = new AuditService(prisma);
    const familyReadService = new FamilyReadService(familyRepo);
    const familyWriteService = new FamilyWriteService(familyRepo, auditService);
    const changeRequestService = new ChangeRequestService(prisma);

    router.get('/:id/full-profile', async (req, res) => {
        const treeId = (req as any).tree.id;
        const familyId = req.params.id;
        try {
            const profile = await familyReadService.getFullProfile(familyId, treeId);
            res.json({ success: true, data: profile });
        } catch (error: any) {
            console.error('Get family profile error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/', async (req, res) => {
        const treeId = (req as any).tree.id;
        const data = req.body;

        try {
            const userId = (req as any).user?.id;

            // Non-owners propose changes instead of applying them directly.
            if ((req as any).permission !== 'OWNER') {
                const cr = await changeRequestService.proposeChange(treeId, userId, 'FAMILY', data.id || null, data.id ? 'UPDATE' : 'CREATE', data, 'Familie');
                return res.status(202).json({ success: true, data: { pending: true, changeRequestId: cr.id, message: 'Änderung zur Bestätigung vorgeschlagen.' } });
            }
            
            let beforeState = null;
            if (data.id) {
                beforeState = await familyRepo.findById(data.id, treeId);
            }

            const result = await familyWriteService.saveFamily(treeId, { ...data, beforeState }, userId);

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Save family error:', error);
            const status = error?.statusCode || error?.status || 500;
            const code = error?.code || 'FAMILY_SAVE_FAILED';
            // Only errors raised deliberately (statusCode set) may surface their
            // message – Prisma/DB internals stay in the log (see `.clinerules/api.md`).
            const message = error?.statusCode
                ? error.message
                : 'Die Familie konnte nicht gespeichert werden. Bitte erneut versuchen.';
            res.status(status).json({ success: false, message, code });
        }
    });

    router.delete('/:id', async (req, res) => {
        const treeId = (req as any).tree.id;
        const familyId = req.params.id;
        const userId = (req as any).user?.id;

        try {
            await familyWriteService.deleteFamily(familyId, treeId, userId);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Delete family error:', error);
            res.status(500).json({ success: false, message: error.message, code: 'FAMILY_DELETE_FAILED' });
        }
    });

    return router;
};
