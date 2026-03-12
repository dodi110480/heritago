import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { TreeService } from '../services/tree.service';
import { PersonService } from '../services/person.service';
import { FamilyService } from '../services/family.service';

export const treeRoutes = (prisma: PrismaClient) => {
    const router = Router();
    const treeService = new TreeService(prisma);
    const personService = new PersonService(prisma);
    const familyService = new FamilyService(prisma);

    // Ensure req.tree is populated for /tree/:tree routes when treeAuth isn't used
    router.use('/tree/:tree', async (req: any, res, next) => {
        if (req.tree) return next();
        try {
            const treeParam = req.params.tree;
            if (treeParam === 'create') return next();
            let tree = await prisma.tree.findUnique({ where: { name: treeParam } });
            if (!tree && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(treeParam)) {
                tree = await prisma.tree.findUnique({ where: { id: treeParam } });
            }
            if (!tree) return res.status(404).json({ success: false, message: 'Tree not found', code: 'TREE_NOT_FOUND' });
            req.tree = tree;
            next();
        } catch (error: any) {
            console.error('Error resolving tree:', error);
            res.status(500).json({ success: false, message: error.message, code: 'TREE_RESOLVE_FAILED' });
        }
    });

    router.get('/trees', async (req, res) => {
        try {
            const user = (req as any).user;
            if (!user) return res.status(401).json({ success: false, message: 'Authentication required', code: 'AUTH_REQUIRED' });
            let trees;
            if (user.globalRole === 'ADMIN') {
                trees = await treeService.getTrees();
            } else {
                trees = await prisma.tree.findMany({
                    where: { permissions: { some: { userId: user.id } } },
                    include: {
                        _count: {
                            select: { persons: true, families: true, media: true }
                        }
                    }
                });
            }
            res.json({ success: true, data: trees });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'TREES_FETCH_FAILED' });
        }
    });

    const handleTreeCreate = async (req: any, res: any) => {
        const { name, title, firstName, lastName, gender, birthDate } = req.body;
        const userId = req.user?.id;
        try {
            const tree = await treeService.createTree({
                name,
                title,
                userId,
                initialPerson: firstName && lastName ? {
                    firstName,
                    lastName,
                    gender,
                    birthDate
                } : undefined
            });
            res.json({ success: true, data: tree });
        } catch (error: any) {
            console.error('Tree creation error:', error);
            const msg = error.message || 'Tree already exists or invalid data';
            const isConflict = msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('bereits');
            res.status(isConflict ? 409 : (msg.includes('besitzen') ? 400 : 500)).json({
                success: false,
                message: msg,
                code: isConflict ? 'TREE_NAME_CONFLICT' : (msg.includes('besitzen') ? 'TREE_PERMISSION_INVALID' : 'TREE_CREATE_FAILED')
            });
        }
    };

    router.post('/trees', handleTreeCreate);
    // Legacy alias (deprecated)
    router.post('/tree/create', handleTreeCreate);

    router.put('/tree/:id', async (req, res) => {
        const { id } = req.params;
        try {
            const tree = await treeService.updateTree(id, req.body);
            res.json({ success: true, data: tree });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message || 'Could not update tree', code: 'TREE_UPDATE_FAILED' });
        }
    });

    router.delete('/tree/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await treeService.deleteTree(id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message || 'Could not delete tree', code: 'TREE_DELETE_FAILED' });
        }
    });

    router.get('/tree/:tree', async (req: any, res) => {
        try {
            const tree = req.tree;
            const data = await treeService.getFullTreeData(tree.id);
            res.json({ success: true, data });
        } catch (error: any) {
            console.error('Error fetching full tree data:', error);
            res.status(500).json({ success: false, message: error.message, code: 'TREE_FETCH_FAILED' });
        }
    });

    router.get('/tree/:tree/stats', async (req, res) => {
        const treeId = (req as any).tree.id;
        try {
            const stats = await treeService.getStats(treeId);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'TREE_STATS_FAILED' });
        }
    });

    router.get('/tree/:tree/analyze-ids', async (req, res) => {
        const treeId = (req as any).tree.id;
        try {
            const { invalidIds, duplicateCleanupCandidates } = await familyService.analyzeInvalidFamilyIds(treeId);
            res.json({ success: true, data: { invalidFamilyIds: invalidIds, duplicateCleanupCandidates } });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'TREE_ANALYZE_FAILED' });
        }
    });

    router.get('/tree/:tree/verify', async (req, res) => {
        const treeId = (req as any).tree.id;
        try {
            const { invalidIds, duplicateCleanupCandidates } = await familyService.analyzeInvalidFamilyIds(treeId);

            const errors = [
                ...invalidIds.map((id) => ({
                    id: `family-id-${id}`,
                    type: 'FAMILY',
                    line: 0,
                    code: 'FAMILY_ID_INVALID',
                    message: `Family with invalid ID format detected: ${id}`,
                    explanation: 'Family IDs should use GEDCOM-like xref format such as @F123@.',
                    content: id
                })),
                ...duplicateCleanupCandidates.map((c: any) => ({
                    id: `family-dup-${c.canonicalId}`,
                    type: 'FAMILY',
                    line: 0,
                    code: 'FAMILY_DUPLICATE_INVALID_ID',
                    message: `Duplicate family candidates for canonical ${c.canonicalId}`,
                    explanation: `Invalid-id duplicates: ${c.deleteIds.join(', ')}`,
                    content: c.signature
                }))
            ];

            res.json({
                success: true,
                data: {
                    errors,
                    meta: {
                        invalidFamilyIds: invalidIds,
                        duplicateCleanupCandidates
                    }
                }
            });
        } catch (error: any) {
            console.error('Diagnostics error:', error);
            res.status(500).json({ success: false, message: error.message, code: 'TREE_DIAGNOSTICS_FAILED' });
        }
    });

    // Alias for frontend compatibility
    router.get(['/tree/:tree/diagnostics', '/tree/:tree/statistics'], async (req, res) => {
        const treeId = (req as any).tree.id;
        try {
            const stats = await treeService.getStats(treeId);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'TREE_STATS_FAILED' });
        }
    });

    router.get('/tree/:tree/calendar', async (req, res) => {
        res.json({ success: true, data: { events: [] } });
    });

    router.get('/tree/:tree/map', async (req, res) => {
        const tree = (req as any).tree;
        
        const dbTree = await prisma.tree.findUnique({
            where: { id: tree.id },
            include: {
                places: {
                    where: {
                        AND: [
                            { latitude: { not: null } },
                            { longitude: { not: null } }
                        ]
                    }
                }
            }
        });

        if (!dbTree) return res.status(404).json({ success: false, message: 'Tree not found', code: 'TREE_NOT_FOUND' });

        const markers = dbTree.places.map(p => ({
            id: p.id,
            name: p.name,
            lat: p.latitude,
            lng: p.longitude
        }));

        const personsWithPlaces = await prisma.person.findMany({
            where: { treeId: tree.id },
            take: 50,
            include: {
                events: {
                    where: { place: { latitude: { not: null }, longitude: { not: null } } },
                    include: { place: true }
                },
                facts: {
                    where: { place: { latitude: { not: null }, longitude: { not: null } } },
                    include: { place: true }
                },
                names: { where: { isPrimary: true } },
                mediaLinks: {
                    include: { media: true }
                }
            }
        });

        const persons = personsWithPlaces.filter(p => p.events.length > 0 || p.facts.length > 0).map((p: any) => {
            const primaryMedia = p.mediaLinks.find((ml: any) => ml.isPrimary)?.media || p.mediaLinks[0]?.media;
            return {
                id: p.id,
                gedcomId: p.gedcomId,
                firstName: p.names[0]?.given || '',
                lastName: p.names[0]?.surname || '',
                profileImageUrl: primaryMedia?.id || '',
                places: [
                    ...p.events.map((e: any) => ({ name: e.place?.name || '', lat: e.place?.latitude, lng: e.place?.longitude })),
                    ...p.facts.map((f: any) => ({ name: f.place?.name || '', lat: f.place?.latitude, lng: f.place?.longitude }))
                ]
            };
        });

        res.json({ success: true, data: { markers, persons } });
    });

    return router;
};
