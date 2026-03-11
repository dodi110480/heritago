import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlaceService } from '../services/place.service';

export const placeRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const placeService = new PlaceService(prisma);

    router.post('/merge', async (req, res) => {
        try {
            const treeName = (req.params as any).tree as string;
            const { sourceId, targetId } = req.body;
            
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

            await placeService.mergePlaces(tree.id, sourceId, targetId);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Merge error:', error);
            const status = error.message.includes('not found') ? 404 : 400;
            res.status(status).json({ success: false, message: error.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const treeName = (req.params as any).tree as string;
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false });

            const places = await placeService.getPlaces(tree.id);
            res.json({ success: true, places });
        } catch (error: any) {
            console.error('Get places error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/search', async (req, res) => {
        try {
            const treeName = (req.params as any).tree as string;
            const { q } = req.query;
            
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false });

            const results = await placeService.searchPlaces(tree.id, q as string);
            res.json({ success: true, results });
        } catch (error: any) {
            console.error('Search error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/:id/usage', async (req, res) => {
        try {
            const treeName = (req.params as any).tree as string;
            const { id } = req.params;
            
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

            const usage = await placeService.getPlaceUsage(tree.id, id);
            res.json({ success: true, usage });
        } catch (error: any) {
            console.error('Get usage error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const treeName = (req.params as any).tree as string;
            const { id } = req.params;
            
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false });

            const place = await placeService.getPlaceById(tree.id, id);
            res.json({ success: true, place });
        } catch (error: any) {
            console.error('Get place error:', error);
            const status = error.message.includes('not found') ? 404 : 500;
            res.status(status).json({ success: false, message: error.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const treeName = (req.params as any).tree as string;
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false });

            const currentUserId = req.body?.userId || (req as any).user?.id || null;
            await placeService.savePlace(tree.id, currentUserId, req.body);
            
            res.json({ success: true });
        } catch (error: any) {
            console.error('Place save error:', error);
            const status = error.statusCode || 500;
            const responseData: any = { success: false, message: error.message };
            if (error.usage) responseData.usage = error.usage;
            
            res.status(status).json(responseData);
        }
    });

    return router;
};
