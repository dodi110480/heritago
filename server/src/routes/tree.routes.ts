import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { TreeService } from '../services/tree.service';
import { PersonService } from '../services/person.service';
import { FamilyService } from '../services/family.service';
import { AuditService } from '../services/audit.service';

export const treeRoutes = (prisma: PrismaClient) => {
    const router = Router();
    const treeService = new TreeService(prisma);
    const personService = new PersonService(prisma);
    const familyService = new FamilyService(prisma);
    const auditService = new AuditService(prisma);

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

    router.get('/tree/:tree/person/:id/full-profile', async (req: any, res) => {
        try {
            const treeId = req.tree.id;
            const personId = req.params.id;
            const profile = await personService.getFullProfile(personId, treeId);
            if (!profile) return res.status(404).json({ success: false, message: 'Person not found' });
            res.json({ success: true, data: profile });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/tree/:tree/family/:id/full-profile', async (req: any, res) => {
        try {
            const treeId = req.tree.id;
            const familyId = req.params.id;
            const profile = await familyService.getFullProfile(familyId, treeId);
            if (!profile) return res.status(404).json({ success: false, message: 'Family not found' });
            res.json({ success: true, data: profile });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/tree/:tree/individuals/search', async (req: any, res) => {
        try {
            const treeId = req.tree.id;
            const rawQuery = (req.query.q || '').toString().trim();
            const query = rawQuery.toLowerCase().trim();
            console.log(`[Backend] Search request for query: "${query}" in tree: ${treeId}`);

            if (!query || query.length < 2) {
                return res.json({ success: true, data: [] });
            }

            const parts = query.split(/\s+/).filter((p: string) => p.length > 0);

            // Also support searching by UUID prefix and GEDCOM id.
            const looksLikeUuidPrefix = /^[0-9a-f\-]{6,}$/i.test(rawQuery);
            const looksLikeGedcom = rawQuery.includes('@');

            const orClauses: any[] = [];

            if (looksLikeUuidPrefix) {
                orClauses.push({ id: { startsWith: rawQuery } });
            }

            if (looksLikeGedcom) {
                orClauses.push({ gedcomId: { contains: rawQuery, mode: 'insensitive' } });
            }

            if (parts.length > 0) {
                orClauses.push({
                    AND: parts.map((part: string) => ({
                        names: {
                            some: {
                                OR: [
                                    { given: { contains: part, mode: 'insensitive' } },
                                    { surname: { contains: part, mode: 'insensitive' } },
                                    { full: { contains: part, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }))
                });
            }

            const individuals = await prisma.person.findMany({
                where: {
                    treeId,
                    OR: orClauses
                },
                select: {
                    id: true,
                    gedcomId: true,
                    sex: true,
                    names: {
                        where: { isPrimary: true },
                        select: { given: true, surname: true, full: true }
                    },
                    events: {
                        where: { type: { in: ['BIRT', 'DEAT'] } },
                        select: { type: true, dateText: true, dateStart: true },
                        orderBy: { sortDate: 'asc' },
                        take: 6
                    }
                },
                take: 20
            });

            const toDateText = (ev: any) => {
                if (!ev) return null;
                return ev.dateText || (ev.dateStart ? new Date(ev.dateStart).toISOString().slice(0, 10) : null);
            };

            const formatted = individuals.map((p: any) => {
                const n = p.names[0];
                const name = n ? (n.full || `${n.given || ''} ${n.surname || ''}`.trim()) : 'Unbekannt';

                const birt = Array.isArray(p.events) ? p.events.find((e: any) => e.type === 'BIRT') : null;
                const deat = Array.isArray(p.events) ? p.events.find((e: any) => e.type === 'DEAT') : null;

                return {
                    id: p.id,
                    gedcomId: p.gedcomId,
                    name,
                    gender: p.sex,
                    birthDate: toDateText(birt),
                    deathDate: toDateText(deat)
                };
            });

            res.json({ success: true, data: formatted });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

router.get('/tree/:tree/individuals/minimal', async (req: any, res) => {
        try {
            const treeId = req.tree.id;
            const individuals = await prisma.person.findMany({
                where: { treeId },
                select: {
                    id: true,
                    gedcomId: true,
                    sex: true,
                    names: {
                        where: { isPrimary: true },
                        select: { given: true, surname: true, full: true }
                    },
                    events: {
                        where: { type: { in: ['BIRT', 'DEAT'] } },
                        select: { type: true, dateText: true, dateStart: true },
                        orderBy: { sortDate: 'asc' },
                        take: 2
                    }
                }
            });

            const toDateText = (ev: any) => {
                if (!ev) return null;
                return ev.dateText || (ev.dateStart ? new Date(ev.dateStart).toISOString().slice(0, 10) : null);
            };

            const formatted = individuals.map((p: any) => {
                const n = p.names[0];
                const name = n ? (n.full || `${n.given || ''} ${n.surname || ''}`.trim()) : 'Unbekannt';

                const birt = Array.isArray(p.events) ? p.events.find((e: any) => e.type === 'BIRT') : null;
                const deat = Array.isArray(p.events) ? p.events.find((e: any) => e.type === 'DEAT') : null;

                return {
                    id: p.id,
                    gedcomId: p.gedcomId,
                    name,
                    gender: p.sex,
                    birthDate: toDateText(birt),
                    deathDate: toDateText(deat)
                };
            });

            res.json({ success: true, data: formatted });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

router.get('/tree/:tree/sources/minimal', async (req: any, res) => {
        try {
            const treeId = req.tree.id;
            const sources = await prisma.source.findMany({
                where: { treeId },
                select: { id: true, title: true }
            });
            res.json({ success: true, data: sources });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
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

    router.get('/tree/:tree/validation', async (req: any, res) => {
        const treeId = req.tree.id;
        try {
            const validationResults = await treeService.validateTree(treeId);
            res.json({ success: true, data: validationResults });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/tree/:tree/validation/summary', async (req: any, res) => {
        const treeId = req.tree.id;
        try {
            const summary = await treeService.getTreeIssuesSummary(treeId);
            res.json({ success: true, data: summary });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    // Unified diagnostics endpoint
    router.get('/tree/:tree/diagnostics', async (req: any, res) => {
        const treeId = req.tree.id;
        try {
            const validationResults = await treeService.validateTree(treeId);
            // Also include stats for backward compatibility if needed by some UI parts
            const stats = await treeService.getStats(treeId);
            res.json({ 
                success: true, 
                data: {
                    issues: validationResults,
                    stats: stats,
                    count: validationResults.length,
                    errors: validationResults.filter((i: any) => i.type === 'error').length,
                    warnings: validationResults.filter((i: any) => i.type === 'warning').length
                } 
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'TREE_DIAGNOSTICS_FAILED' });
        }
    });

    router.get('/tree/:tree/statistics', async (req, res) => {
        const treeId = (req as any).tree.id;
        try {
            const stats = await treeService.getStats(treeId);
            res.json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'TREE_STATS_FAILED' });
        }
    });

    router.get('/tree/:tree/hierarchy', async (req: any, res) => {
        const treeId = req.tree.id;
        try {
            const hierarchy = await treeService.getMiniTreeHierarchy(treeId);
            res.json({ success: true, data: hierarchy });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/tree/:tree/chart-data', async (req: any, res) => {
        const treeId = req.tree.id;
        try {
            const chartData = await treeService.getFamilyChartData(treeId);
            res.json({ success: true, data: chartData });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/tree/:tree/calendar', async (req, res) => {
        res.json({ success: true, data: { events: [] } });
    });

    router.get('/tree/:tree/map', async (req: any, res) => {
        try {
            const treeId = req.tree.id;
            const data = await treeService.getMapData(treeId);
            res.json({ success: true, data });
        } catch (error: any) {
            console.error('Map data error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
    
    router.get('/tree/:tree/places/hierarchy', async (req: any, res) => {
        const treeId = req.tree.id;
        const search = req.query.q as string;
        try {
            const placeService = new (require('../services/place.service').PlaceService)(prisma);
            const hierarchy = await placeService.getPlacesHierarchy(treeId, search);
            res.json({ success: true, data: hierarchy });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/tree/:tree/changelog', async (req: any, res) => {
        const treeId = req.tree.id;
        try {
            const logs = await auditService.getChangeLog(treeId);
            res.json({ success: true, data: logs });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
