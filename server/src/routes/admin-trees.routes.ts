import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { TreeService } from '../services/tree.service';
import { requireAdmin } from '../middleware/requireAdmin';

/**
 * Admin-only tree administration routes (metadata + ownership management).
 * Mounted under `/api/admin`. The admin never sees genealogy data here —
 * only structural metadata, owners and collaborators (see auth-rbac.md § 1.1).
 */
export const adminTreeRoutes = (prisma: PrismaClient) => {
    const router = Router();
    const treeService = new TreeService(prisma);

    // Every endpoint in this router requires the global ADMIN role.
    router.use(requireAdmin(prisma));

    // List all trees with metadata (owners, collaborators, counts, orphaned flag).
    router.get('/trees', async (req, res) => {
        try {
            const trees = await treeService.listAllTreesForAdmin();
            res.json({ success: true, data: trees });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'ADMIN_TREES_FETCH_FAILED' });
        }
    });

    // Reassign a tree's owner (also used to rescue orphaned trees).
    router.patch('/trees/:id/owner', async (req, res) => {
        try {
            const { userId } = req.body;
            if (!userId) {
                return res.status(400).json({ success: false, message: 'userId fehlt.', code: 'VALIDATION_ERROR' });
            }
            await treeService.reassignTreeOwner(req.params.id, userId);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message, code: 'ADMIN_TREE_REASSIGN_FAILED' });
        }
    });

    return router;
};
