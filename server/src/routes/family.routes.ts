import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { FamilyService } from '../services/family.service';

export const familyRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const familyService = new FamilyService(prisma);

    router.post('/', async (req, res) => {
        const treeId = (req as any).tree.id;
        const data = req.body;

        try {
            const userId = (req as any).user?.id;
            
            // Optional: fetch beforeState if we want extremely detailed logs
            let beforeState = null;
            if (data.id) {
                beforeState = await prisma.family.findUnique({
                    where: { treeId_gedcomId: { treeId, gedcomId: data.id } },
                    include: { familyMembers: true, events: true, noteLinks: true }
                });
            }

            const result = await familyService.saveFamily(treeId, { ...data, beforeState }, userId);

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Save family error:', error);
            const message = error?.message || 'Failed to save family';
            const isValidationError =
                message.includes('cannot be the same person') ||
                message.includes('cannot be added as child') ||
                message.includes('Referenced person(s) not found') ||
                message.includes('Family ID is required') ||
                message.includes('Family ID must use GEDCOM format');
            res.status(isValidationError ? 400 : 500).json({
                success: false,
                message,
                code: isValidationError ? 'FAMILY_VALIDATION_ERROR' : 'FAMILY_SAVE_FAILED'
            });
        }
    });

    router.post('/cleanup-invalid-ids', async (req, res) => {
        try {
            const treeId = (req as any).tree.id;
            const { dryRun = true } = req.body || {};

            const { invalidIds, duplicateCleanupCandidates } = await familyService.analyzeInvalidFamilyIds(treeId);
            const deleteIds = Array.from(new Set(duplicateCleanupCandidates.flatMap((c: any) => c.deleteIds)));

            if (!dryRun && deleteIds.length > 0) {
                await prisma.family.deleteMany({
                    where: { treeId: treeId, id: { in: deleteIds } }
                });
            }

            res.json({
                success: true,
                data: {
                    dryRun: !!dryRun,
                    invalidFamilyIds: invalidIds,
                    duplicateCleanupCandidates,
                    deleteIds,
                    deletedCount: dryRun ? 0 : deleteIds.length
                }
            });
        } catch (error: any) {
            console.error('Cleanup invalid family IDs error:', error);
            res.status(500).json({ success: false, message: error.message, code: 'FAMILY_CLEANUP_FAILED' });
        }
    });

    router.post('/delete-invalid-ids', async (req, res) => {
        try {
            const treeId = (req as any).tree.id;
            const { ids } = req.body || {};
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: 'ids array is required', code: 'VALIDATION_ERROR' });
            }

            const requestedIds = ids.map((x: any) => String(x || '').trim()).filter(Boolean);
            const existing = await prisma.family.findMany({
                where: { treeId: treeId, id: { in: requestedIds } },
                select: { id: true, gedcomId: true }
            });

            const deletable = existing
                .filter(f => !FamilyService.isGedcomXref(f.gedcomId || ''))
                .map(f => f.id);

            let deletedCount = 0;
            if (deletable.length > 0) {
                const del = await prisma.family.deleteMany({
                    where: { treeId: treeId, id: { in: deletable } }
                });
                deletedCount = del.count;
            }

            const skipped = requestedIds.filter(id => !deletable.includes(id));

            res.json({
                success: true,
                data: {
                    requestedIds,
                    deletedIds: deletable,
                    deletedCount,
                    skippedIds: skipped
                }
            });
        } catch (error: any) {
            console.error('Delete invalid family IDs error:', error);
            res.status(500).json({ success: false, message: error.message, code: 'FAMILY_DELETE_INVALID_FAILED' });
        }
    });

    return router;
};
