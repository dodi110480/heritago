import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { RepositoryService } from '../services/repository.service';

export const repositoryRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const repositoryService = new RepositoryService(prisma);

    router.get('/', async (req, res) => {
        const treeId = (req as any).tree.id;
        try {
            const repositories = await repositoryService.getRepositories(treeId);
            res.json({ success: true, data: repositories });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'REPOSITORY_FETCH_FAILED' });
        }
    });

    router.post('/', async (req, res) => {
        const treeId = (req as any).tree.id;
        const { id, mode } = req.body;

        try {
            if (mode === 'delete' && id) {
                await repositoryService.deleteRepository(treeId, id);
                return res.json({ success: true, data: null });
            }

            await repositoryService.saveRepository(treeId, req.body);
            res.json({ success: true, data: null });
        } catch (error: any) {
            console.error('Repository save error:', error);
            const status = error.message.includes('not found') ? 404 : (error.message.includes('required') ? 400 : 500);
            res.status(status).json({
                success: false,
                message: error.message,
                code: status === 404 ? 'REPOSITORY_NOT_FOUND' : (status === 400 ? 'REPOSITORY_VALIDATION_ERROR' : 'REPOSITORY_SAVE_FAILED')
            });
        }
    });

    return router;
};
