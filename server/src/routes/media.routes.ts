import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { MediaService } from '../services/media.service';
import { upload } from '../config';

export const mediaRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const mediaService = new MediaService(prisma);

    // Get all media for a tree
    router.get('/file/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const { variant } = req.query;
            const tree = req.tree;
            if (!tree) return res.status(400).json({ success: false, message: 'Tree context required', code: 'TREE_CONTEXT_REQUIRED' });
            const media = await prisma.media.findUnique({ where: { id, treeId: tree.id } });
            if (!media) return res.status(404).json({ success: false, message: 'Media not found', code: 'MEDIA_NOT_FOUND' });
            const fileInfo = await mediaService.getMediaFilePath(id, variant as string);
            if (!fileInfo) return res.status(404).json({ success: false, message: 'File not found', code: 'MEDIA_FILE_NOT_FOUND' });
            
            res.setHeader('Content-Type', fileInfo.mimeType);
            res.sendFile(fileInfo.path);
        } catch (error: any) {
            console.error('File serving error:', error);
            res.status(500).json({ success: false, message: error.message, code: 'MEDIA_FILE_FAILED' });
        }
    });

    // Get all media for a tree
    router.get('/', async (req: any, res) => {
        try {
            const tree = req.tree;
            if (!tree) return res.status(400).json({ success: false, message: 'Tree context required', code: 'TREE_CONTEXT_REQUIRED' });
            const { type, search } = req.query;
            const result = await mediaService.getMedia(tree.id, type as string, search as string);
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Fetch media error:', error);
            res.status(500).json({ success: false, message: error.message, code: 'MEDIA_FETCH_FAILED' });
        }
    });

    // Adopt an orphan file into the tree
    router.post('/adopt-orphan', async (req: any, res) => {
        try {
            const tree = req.tree;
            if (!tree) return res.status(400).json({ success: false, message: 'Tree context required', code: 'TREE_CONTEXT_REQUIRED' });
            const { path: filePath, title, mediaType } = req.body;
            const media = await mediaService.adoptOrphan(tree.id, filePath, title, mediaType);
            res.json({ success: true, data: media });
        } catch (error: any) {
            console.error('Adopt orphan error:', error);
            const status = error.message.includes('not found') ? 404 : (error.message.includes('Invalid') ? 400 : 500);
            res.status(status).json({ success: false, message: error.message, code: status === 404 ? 'MEDIA_NOT_FOUND' : (status === 400 ? 'MEDIA_VALIDATION_ERROR' : 'MEDIA_ADOPT_FAILED') });
        }
    });

    // Upload a new file
    router.post('/upload', upload.single('file'), async (req: any, res) => {
        try {
            const tree = req.tree;
            if (!tree) return res.status(400).json({ success: false, message: 'Tree context required', code: 'TREE_CONTEXT_REQUIRED' });
            if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded', code: 'MEDIA_FILE_REQUIRED' });

            const media = await mediaService.uploadMedia(tree.id, req.file, req.body);
            res.json({ success: true, data: media });
        } catch (error: any) {
            console.error('Upload error:', error);
            res.status(error.message === 'pixel_limit_exceeded' ? 400 : 500).json({
                success: false,
                message: error.message,
                code: error.message === 'pixel_limit_exceeded' ? 'MEDIA_PIXEL_LIMIT' : 'MEDIA_UPLOAD_FAILED'
            });
        }
    });

    router.get('/:id', async (req: any, res) => {
        const { id } = req.params;
        const tree = req.tree;
        if (!tree) return res.status(400).json({ success: false, message: 'Tree context required', code: 'TREE_CONTEXT_REQUIRED' });
        try {
            const media = await prisma.media.findUnique({
                where: { id, treeId: tree.id },
                include: {
                    links: {
                        include: {
                            person: { include: { names: { where: { isPrimary: true } } } },
                            family: true
                        }
                    },
                    noteLinks: { include: { note: true } },
                    citations: { include: { source: true } },
                    variants: true
                }
            });
            if (!media) return res.status(404).json({ success: false, message: 'Media not found', code: 'MEDIA_NOT_FOUND' });
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'MEDIA_FETCH_FAILED' });
        }
    });

    router.post('/:id', async (req: any, res) => {
        const { id } = req.params;
        const tree = req.tree;
        if (!tree) return res.status(400).json({ success: false, message: 'Tree context required', code: 'TREE_CONTEXT_REQUIRED' });
        try {
            const exists = await prisma.media.findUnique({ where: { id, treeId: tree.id } });
            if (!exists) return res.status(404).json({ success: false, message: 'Media not found', code: 'MEDIA_NOT_FOUND' });
            const media = await mediaService.saveMedia(id, req.body);
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(error.message === 'Media not found' ? 404 : 500).json({
                success: false,
                message: error.message,
                code: error.message === 'Media not found' ? 'MEDIA_NOT_FOUND' : 'MEDIA_SAVE_FAILED'
            });
        }
    });

    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        const tree = (req as any).tree;
        if (!tree) return res.status(400).json({ success: false, message: 'Tree context required', code: 'TREE_CONTEXT_REQUIRED' });
        try {
            const exists = await prisma.media.findUnique({ where: { id, treeId: tree.id } });
            if (!exists) return res.status(404).json({ success: false, message: 'Media not found', code: 'MEDIA_NOT_FOUND' });
            await mediaService.deleteMedia(id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(error.message === 'Media not found' ? 404 : 500).json({
                success: false,
                message: error.message,
                code: error.message === 'Media not found' ? 'MEDIA_NOT_FOUND' : 'MEDIA_DELETE_FAILED'
            });
        }
    });

    return router;
};
