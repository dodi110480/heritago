import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { MediaReadService } from '../services/media/media.read.service';
import { MediaWriteService } from '../services/media/media.write.service';
import { MediaRepository } from '../repositories/media.repository';
import { AuditService } from '../services/audit.service';
import { MediaService } from '../services/media.service';
import { upload } from '../config';
import { NotesService } from '../services/notes.service';

export const mediaRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    
    // Manual DI
    const mediaRepo = new MediaRepository(prisma);
    const auditService = new AuditService(prisma);
    const notesService = new NotesService(prisma);
    const mediaReadService = new MediaReadService(mediaRepo);
    const mediaWriteService = new MediaWriteService(mediaRepo, auditService);
    
    // Legacy service for complex operations
    const legacyMediaService = new MediaService(prisma, notesService);

    // Get file content
    router.get('/file/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const { variant } = req.query;
            const fileInfo = await legacyMediaService.getMediaFilePath(id, variant as string);
            if (!fileInfo) return res.status(404).json({ success: false, message: 'File not found' });
            res.setHeader('Content-Type', fileInfo.mimeType);
            res.sendFile(fileInfo.path);
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // List all media
    router.get('/', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { type, search } = req.query;
            
            if (type || search) {
                const result = await legacyMediaService.getMedia(tree.id, type as string, search as string);
                return res.json({ success: true, data: result });
            }

            const media = await mediaReadService.getMediaList(tree.id);
            res.json({ success: true, data: { media, stats: { total: media.length } } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Upload a new file
    router.post('/upload', upload.single('file'), async (req: any, res) => {
        try {
            const tree = req.tree;
            if (!req.file) throw new Error('No file');
            const media = await legacyMediaService.uploadMedia(tree.id, req.file, req.body);
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Get single media
    router.get('/:id', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { id } = req.params;
            const media = await mediaReadService.getMedia(id, tree.id);
            if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Save/Update media metadata
    router.patch('/:id', async (req: any, res) => {
        try {
            const tree = req.tree;
            const userId = req.user?.id;
            const media = await mediaWriteService.saveMedia(tree.id, { ...req.body, id: req.params.id }, userId);
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Delete media
    router.delete('/:id', async (req: any, res) => {
        try {
            const tree = req.tree;
            const userId = req.user?.id;
            await mediaWriteService.deleteMedia(req.params.id, tree.id, userId);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Crop functionality
    router.patch('/:id/crop', async (req: any, res) => {
        try {
            const tree = req.tree;
            const media = await legacyMediaService.updateCrop(tree.id, req.params.id, req.body);
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.delete('/:id/crop', async (req: any, res) => {
        try {
            const tree = req.tree;
            const media = await legacyMediaService.resetCrop(tree.id, req.params.id);
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Usage and Linking
    router.get('/:id/usage', async (req: any, res) => {
        try {
            const usage = await legacyMediaService.getMediaUsage(req.tree.id, req.params.id);
            res.json({ success: true, data: { usage } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/:id/link', async (req: any, res) => {
        try {
            const link = await legacyMediaService.linkMedia(req.tree.id, req.params.id, req.body);
            res.json({ success: true, data: { link } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.delete('/link/:linkId', async (req: any, res) => {
        try {
            await legacyMediaService.unlinkMedia(req.tree.id, req.params.linkId);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Orphan files
    router.post('/adopt-orphan', async (req: any, res) => {
        try {
            const media = await legacyMediaService.adoptOrphan(req.tree.id, req.body.path, req.body.title, req.body.mediaType);
            res.json({ success: true, data: media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.delete('/orphan-file', async (req: any, res) => {
        try {
            const deleted = await legacyMediaService.deleteOrphanFile(req.tree.id, req.body.path);
            res.json({ success: true, data: { deleted } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
