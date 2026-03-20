import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { FamilyReadService } from '../services/family/family.read.service';
import { FamilyWriteService } from '../services/family/family.write.service';
import { FamilyRepository } from '../repositories/family.repository';
import { AuditService } from '../services/audit.service';

export const familyRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    
    // Manual DI
    const familyRepo = new FamilyRepository(prisma);
    const auditService = new AuditService(prisma);
    const familyReadService = new FamilyReadService(familyRepo);
    const familyWriteService = new FamilyWriteService(familyRepo, auditService);

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
            
            let beforeState = null;
            if (data.id) {
                beforeState = await familyRepo.findById(data.id, treeId);
            }

            const result = await familyWriteService.saveFamily(treeId, { ...data, beforeState }, userId);

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Save family error:', error);
            const message = error?.message || 'Failed to save family';
            // Placeholder: simplified validation error handling
            res.status(500).json({
                success: false,
                message,
                code: 'FAMILY_SAVE_FAILED'
            });
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
