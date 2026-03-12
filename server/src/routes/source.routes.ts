import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { SourceService } from '../services/source.service';

export const sourceRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const sourceService = new SourceService(prisma);

    router.get('/', async (req, res) => {
        const treeId = (req as any).tree.id;
        try {
            const sources = await sourceService.getSources(treeId);
            res.json({ success: true, data: sources });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'SOURCE_FETCH_FAILED' });
        }
    });

    router.get('/:id', async (req, res) => {
        const treeId = (req as any).tree.id;
        const { id } = req.params;
        try {
            const source = await sourceService.getSourceById(treeId, id);
            if (!source) return res.status(404).json({ success: false, message: 'Source not found', code: 'SOURCE_NOT_FOUND' });
            res.json({ success: true, data: source });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'SOURCE_FETCH_FAILED' });
        }
    });

    router.get('/:id/usage', async (req, res) => {
        const treeId = (req as any).tree.id;
        const { id } = req.params;
        try {
            const usage = await sourceService.getSourceUsage(treeId, id);
            res.json({ success: true, data: usage });
        } catch (error: any) {
            res.status(error.message === 'Source not found' ? 404 : 500).json({
                success: false,
                message: error.message,
                code: error.message === 'Source not found' ? 'SOURCE_NOT_FOUND' : 'SOURCE_USAGE_FAILED'
            });
        }
    });

    router.post('/merge', async (req, res) => {
        const treeId = (req as any).tree.id;
        const { sourceId, targetId } = req.body;
        if (!sourceId || !targetId || sourceId === targetId) {
            return res.status(400).json({ success: false, message: 'sourceId and targetId required and must differ', code: 'VALIDATION_ERROR' });
        }

        try {
            await sourceService.mergeSources(treeId, sourceId, targetId);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(error.message.includes('not found') ? 404 : 500).json({
                success: false,
                message: error.message,
                code: error.message.includes('not found') ? 'SOURCE_NOT_FOUND' : 'SOURCE_MERGE_FAILED'
            });
        }
    });

    router.post('/', async (req, res) => {
        const treeId = (req as any).tree.id;
        const { mode, id, reassignToId } = req.body;
        const currentUserId = (req as any).user?.id;

        try {
            if (mode === 'delete' && id) {
                const result = await sourceService.deleteSource(treeId, id, reassignToId);
                if ('inUse' in result) {
                    return res.status(409).json({
                        success: false,
                        message: 'Source is still in use. Provide reassignToId or merge first.',
                        code: 'SOURCE_IN_USE',
                        data: { usage: result.usageCount }
                    });
                }
                return res.json({ success: true, data: null });
            }

            await sourceService.saveSource(treeId, req.body, currentUserId);
            res.json({ success: true, data: null });
        } catch (error: any) {
            console.error('Source save error:', error);
            const status = error.message.includes('not found') ? 404 : (error.message.includes('required') ? 400 : 500);
            res.status(status).json({
                success: false,
                message: error.message,
                code: status === 404 ? 'SOURCE_NOT_FOUND' : (status === 400 ? 'SOURCE_VALIDATION_ERROR' : 'SOURCE_SAVE_FAILED')
            });
        }
    });

    return router;
};
