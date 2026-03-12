import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PlaceService } from '../services/place.service';

export const placeRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const placeService = new PlaceService(prisma);

    router.post('/merge', async (req, res) => {
        try {
            const tree = (req as any).tree;
            const { sourceId, targetId } = req.body;
            
            await placeService.mergePlaces(tree.id, sourceId, targetId);
            res.json({ success: true, data: null });
        } catch (error: any) {
            console.error('Merge error:', error);
            const status = error.message.includes('not found') ? 404 : 400;
            res.status(status).json({
                success: false,
                message: error.message,
                code: status === 404 ? 'PLACE_NOT_FOUND' : 'PLACE_VALIDATION_ERROR'
            });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const tree = (req as any).tree;
            const places = await placeService.getPlaces(tree.id);
            res.json({ success: true, data: places });
        } catch (error: any) {
            console.error('Get places error:', error);
            res.status(500).json({ success: false, message: 'Internal server error', code: 'PLACE_FETCH_FAILED' });
        }
    });

    router.get('/search', async (req, res) => {
        try {
            const tree = (req as any).tree;
            const { q } = req.query;
            
            const results = await placeService.searchPlaces(tree.id, q as string);
            res.json({ success: true, data: results });
        } catch (error: any) {
            console.error('Search error:', error);
            res.status(500).json({ success: false, message: 'Internal server error', code: 'PLACE_SEARCH_FAILED' });
        }
    });

    router.get('/:id/usage', async (req, res) => {
        try {
            const tree = (req as any).tree;
            const { id } = req.params;
            
            const usage = await placeService.getPlaceUsage(tree.id, id);
            res.json({ success: true, data: usage });
        } catch (error: any) {
            console.error('Get usage error:', error);
            res.status(500).json({ success: false, message: 'Internal server error', code: 'PLACE_USAGE_FAILED' });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const tree = (req as any).tree;
            const { id } = req.params;
            
            const place = await placeService.getPlaceById(tree.id, id);
            res.json({ success: true, data: place });
        } catch (error: any) {
            console.error('Get place error:', error);
            const status = error.message.includes('not found') ? 404 : 500;
            res.status(status).json({
                success: false,
                message: error.message,
                code: status === 404 ? 'PLACE_NOT_FOUND' : 'PLACE_FETCH_FAILED'
            });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const tree = (req as any).tree;
            const currentUserId = (req as any).user?.id || null;
            await placeService.savePlace(tree.id, currentUserId, req.body);
            
            res.json({ success: true, data: null });
        } catch (error: any) {
            console.error('Place save error:', error);
            const status = error.statusCode || 500;
            const responseData: any = {
                success: false,
                message: error.message,
                code: status === 409 ? 'PLACE_IN_USE' : (status === 400 ? 'PLACE_VALIDATION_ERROR' : 'PLACE_SAVE_FAILED')
            };
            if (error.usage) responseData.usage = error.usage;
            
            res.status(status).json(responseData);
        }
    });

    return router;
};
