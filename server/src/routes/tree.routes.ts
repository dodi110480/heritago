import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { STORAGE_ROOT, MEDIA_ROOT } from '../config';
import { GedcomManager } from '../services/gedcom.service';
import { analyzeInvalidFamilyIds } from './family.routes';

export const treeRoutes = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/trees', async (req, res) => {
        const trees = await prisma.tree.findMany();
        res.json({ success: true, trees });
    });

    router.post('/tree/create', async (req, res) => {
        const { name, title, firstName, lastName, gender, birthDate, userId } = req.body;
        
        try {
            // Enforce one tree limit for non-admins
            if (userId) {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user && user.globalRole !== 'ADMIN') {
                    const ownerCount = await prisma.treePermission.count({
                        where: { userId, level: 'OWNER' }
                    });
                    if (ownerCount >= 1) {
                        return res.status(400).json({ success: false, message: 'Du kannst nur einen Stammbaum besitzen.' });
                    }
                }
            }

            const tree = await prisma.tree.create({ data: { name, title } });

            // If userId is provided, create OWNER permission
            if (userId) {
                await prisma.treePermission.create({
                    data: {
                        treeId: tree.id,
                        userId,
                        level: 'OWNER'
                    }
                });
            }

            // Create the initial person if data is provided
            if (firstName && lastName) {
                await GedcomManager.createPerson(prisma, tree.id, {
                    firstName,
                    lastName,
                    gender,
                    birthDate
                });
            }

            res.json({ success: true, tree });
        } catch (error) {
            console.error('Tree creation error:', error);
            res.status(400).json({ success: false, message: 'Tree already exists or invalid data' });
        }
    });

    router.put('/tree/:id', async (req, res) => {
        const { id } = req.params;
        const { title, description } = req.body;
        try {
            const tree = await prisma.tree.update({
                where: { id },
                data: { title, description }
            });
            res.json({ success: true, tree });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Could not update tree' });
        }
    });

    router.delete('/tree/:id', async (req, res) => {
        const { id } = req.params;
        try {
            // Find media to delete files
            const media = await prisma.media.findMany({ where: { treeId: id } });
            for (const m of media) {
                const fname = m.path;
                if (fname) {
                    const baseDir = fname.startsWith('users/') ? STORAGE_ROOT : MEDIA_ROOT;
                    const fullPath = path.join(baseDir, fname);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                }
            }

            await prisma.tree.delete({ where: { id } });
            res.json({ success: true });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Could not delete tree' });
        }
    });

    router.get('/tree/:tree', async (req, res) => {
        const { tree: treeName } = req.params;
        const tree = await prisma.tree.findUnique({
            where: { name: treeName },
            include: {
                persons: {
                    include: {
                        names: true,
                        events: {
                            include: {
                                place: true,
                                mediaLinks: { include: { media: true } },
                                noteLinks: { include: { note: true } },
                                citations: { include: { source: true } },
                                associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                            }
                        },
                        facts: {
                            include: {
                                place: true,
                                noteLinks: { include: { note: true } },
                                citations: { include: { source: true } },
                                associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                            }
                        },
                        citations: { include: { source: true } },
                        mediaLinks: { include: { media: true } },
                        noteLinks: { include: { note: true } },
                        familyMembers: { include: { family: true } },
                        associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } },
                        dnaMatches: { include: { matchPerson: true, segments: true } },
                        dnaSegments: true
                    }
                },
                families: {
                    include: {
                        events: {
                            include: {
                                place: true,
                                mediaLinks: { include: { media: true } },
                                noteLinks: { include: { note: true } },
                                citations: { include: { source: true } },
                                associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } }
                            }
                        },
                        familyMembers: { include: { person: true } },
                        mediaLinks: { include: { media: true } },
                        noteLinks: { include: { note: true } }
                    }
                }
            }
        });

        if (!tree) return res.status(404).json({ success: false });

        const individuals = tree.persons.map(i => GedcomManager.formatGedcom(i));
        const families = tree.families.map(f => GedcomManager.formatFamily(f));


        res.json({ success: true, individuals, families, meta: { tree: treeName, treeId: tree.id } });
    });

    router.get('/tree/:tree/changelog', async (req, res) => {
        const { tree: treeName } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const logs = await prisma.changeLog.findMany({
            where: { treeId: tree.id },
            include: { user: { select: { username: true } } },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json({ success: true, logs });
    });

    router.get('/tree/:tree/statistics', async (req, res) => {
        const { tree: treeName } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const counts = {
            individuals: await prisma.person.count({ where: { treeId: tree.id } }),
            families: await prisma.family.count({ where: { treeId: tree.id } }),
            media: await prisma.media.count({ where: { treeId: tree.id } }),
            places: await prisma.place.count({ where: { treeId: tree.id } }),
            sources: await prisma.source.count({ where: { treeId: tree.id } }),
        };

        const gender = {
            male: await prisma.person.count({ where: { treeId: tree.id, sex: 'M' } }),
            female: await prisma.person.count({ where: { treeId: tree.id, sex: 'F' } }),
            unknown: await prisma.person.count({ where: { treeId: tree.id, sex: 'U' } }),
        };

        res.json({ success: true, counts, gender });
    });

    router.get('/tree/:tree/diagnostics', async (req, res) => {
        try {
            const { tree: treeName } = req.params;
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

            const { invalidIds, duplicateCleanupCandidates } = await analyzeInvalidFamilyIds(prisma, tree.id);

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
                ...duplicateCleanupCandidates.map((c) => ({
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
                errors,
                meta: {
                    invalidFamilyIds: invalidIds,
                    duplicateCleanupCandidates
                }
            });
        } catch (error: any) {
            console.error('Diagnostics error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/tree/:tree/calendar', async (req, res) => {
        // Empty calendar for now to avoid 404
        res.json({ success: true, events: [] });
    });

    router.get('/tree/:tree/map', async (req, res) => {
        const { tree: treeName } = req.params;
        const tree = await prisma.tree.findUnique({
            where: { name: treeName },
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

        if (!tree) return res.status(404).json({ success: false });

        const markers = tree.places.map(p => ({
            id: p.id,
            name: p.name,
            lat: p.latitude,
            lng: p.longitude
        }));

        // Find persons with places in this tree
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

        res.json({ success: true, markers, persons });
    });

    return router;
};
