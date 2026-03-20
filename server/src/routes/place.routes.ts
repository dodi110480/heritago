import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlaceReadService } from '../services/place/place.read.service';
import { PlaceWriteService } from '../services/place/place.write.service';
import { PlaceRepository } from '../repositories/place.repository';
import { AuditService } from '../services/audit.service';
import { PlaceService } from '../services/place.service';

export const placeRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    
    // Manual DI
    const placeRepo = new PlaceRepository(prisma);
    const auditService = new AuditService(prisma);
    const placeReadService = new PlaceReadService(placeRepo);
    const placeWriteService = new PlaceWriteService(placeRepo, auditService);
    
    // Legacy service for complex operations not yet fully migrated
    const legacyPlaceService = new PlaceService(prisma);

    router.post('/merge', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { sourceId, targetId } = req.body;
            await legacyPlaceService.mergePlaces(tree.id, sourceId, targetId);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.get('/', async (req: any, res) => {
        try {
            const tree = req.tree;
            const places = await placeReadService.getPlaces(tree.id);
            res.json({ success: true, data: places });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/search', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { q } = req.query;
            const results = await placeReadService.searchPlaces(q as string, tree.id);
            res.json({ success: true, data: results });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/hierarchy', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { search } = req.query;
            const roots = await legacyPlaceService.getPlacesHierarchy(tree.id, search as string);
            res.json({ success: true, data: roots });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/:id/usage', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { id } = req.params;
            const usage = await legacyPlaceService.getPlaceUsage(tree.id, id);
            res.json({ success: true, data: usage });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/:id', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { id } = req.params;
            const place = await placeReadService.getPlace(id, tree.id);
            if (!place) return res.status(404).json({ success: false, message: 'Place not found' });
            res.json({ success: true, data: place });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/', async (req: any, res) => {
        try {
            const tree = req.tree;
            const userId = req.user?.id;
            const result = await placeWriteService.savePlace(tree.id, req.body, userId);
            res.json({ success: true, data: result });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
