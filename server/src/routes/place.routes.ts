import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const placeRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });

    router.post('/merge', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { sourceId, targetId } = req.body;
        if (!sourceId || !targetId || sourceId === targetId) {
            return res.status(400).json({ success: false, message: 'sourceId and targetId required and must differ' });
        }

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const [source, target] = await Promise.all([
            prisma.place.findFirst({ where: { id: sourceId, treeId: tree.id } }),
            prisma.place.findFirst({ where: { id: targetId, treeId: tree.id } })
        ]);
        if (!source || !target) return res.status(404).json({ success: false, message: 'Source or target not found' });

        await prisma.$transaction(async (tx) => {
            await tx.event.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
            await tx.fact.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
            await tx.association.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
            await tx.place.updateMany({ where: { parentId: source.id }, data: { parentId: target.id } });
            await tx.place.delete({ where: { id: source.id } });
        });

        await prisma.changeLog.create({
            data: {
                treeId: tree.id,
                action: 'UPDATE',
                entityType: 'PLACE',
                entityId: target.id,
                summary: `Ort ${source.name} in ${target.name} zusammengeführt`
            }
        });

        res.json({ success: true });
    });

    router.get('/', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const places = await prisma.place.findMany({
            where: { treeId: tree.id },
            include: {
                _count: {
                    select: {
                        events: true,
                        facts: true,
                        associations: true,
                        children: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json({
            success: true,
            places: places.map(p => ({
                ...p,
                usage: {
                    eventCount: p._count.events,
                    factCount: p._count.facts,
                    associationCount: p._count.associations,
                    childCount: p._count.children,
                    total: p._count.events + p._count.facts + p._count.associations
                }
            }))
        });
    });

    router.get('/search', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { q } = req.query;
        if (!q) return res.json({ success: true, results: [] });

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const places = await prisma.place.findMany({
            where: {
                treeId: tree.id,
                name: { contains: q as string, mode: 'insensitive' }
            },
            take: 10
        });

        res.json({ success: true, results: places.map(p => p.name) });
    });

    router.get('/:id/usage', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { id } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const [events, facts, children, associations] = await Promise.all([
            prisma.event.findMany({
                where: { placeId: id, treeId: tree.id },
                include: {
                    person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                    family: true
                }
            }),
            prisma.fact.findMany({
                where: { placeId: id, treeId: tree.id },
                include: {
                    person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                    family: true
                }
            }),
            prisma.place.findMany({
                where: { parentId: id, treeId: tree.id }
            }),
            prisma.association.findMany({
                where: { placeId: id, treeId: tree.id },
                include: {
                    person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                    family: true
                }
            })
        ]);

        const personLabel = (p: any) =>
            p ? `${p.names?.[0]?.given || ''} ${p.names?.[0]?.surname || ''}`.trim() || p.gedcomId || p.id : null;

        const results = [];

        for (const e of events) {
            results.push({
                context: `Ereignis (${e.type})`,
                contextLabel: personLabel(e.person) || e.family?.gedcomId || 'Unbekannt',
                entityId: e.personId || e.familyId,
                entityType: e.personId ? 'person' : (e.familyId ? 'family' : null),
                dateText: e.dateText
            });
        }

        for (const f of facts) {
            results.push({
                context: `Fakt (${f.type})`,
                contextLabel: personLabel(f.person) || f.family?.gedcomId || 'Unbekannt',
                entityId: f.personId || f.familyId,
                entityType: f.personId ? 'person' : (f.familyId ? 'family' : null),
                dateText: f.dateText
            });
        }

        for (const a of associations) {
            results.push({
                context: `Verknüpfung (${a.role})`,
                contextLabel: personLabel(a.person) || a.family?.gedcomId || 'Unbekannt',
                entityId: a.personId || a.familyId,
                entityType: a.personId ? 'person' : (a.familyId ? 'family' : null),
                dateText: a.dateText
            });
        }

        for (const c of children) {
            results.push({
                context: 'Untergeordneter Ort',
                contextLabel: c.name,
                entityId: c.id,
                entityType: 'place-detail', // Use this type to trigger navigation in my future standardized list
                dateText: null
            });
        }

        res.json({
            success: true,
            usage: results
        });
    });

    router.get('/:id', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { id } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const place = await prisma.place.findFirst({
            where: { id, treeId: tree.id },
            include: {
                translations: true,
                identifiers: true,
                noteLinks: { include: { note: true } }
            }
        });

        if (!place) return res.status(404).json({ success: false, message: 'Place not found' });

        res.json({
            success: true,
            place: {
                ...place,
                notes: place.noteLinks.map(nl => ({
                    id: nl.note.id,
                    text: nl.note.text,
                    noteType: nl.note.noteType,
                    privacyLevel: nl.note.privacyLevel,
                    isPrivate: nl.note.privacyLevel === 'PRIVATE'
                }))
            }
        });
    });

    router.post('/', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const {
            id,
            name,
            old_name,
            latitude,
            longitude,
            mode,
            jurisdiction,
            historicNames,
            parentId,
            reassignToId,
            form,
            phrase,
            level,
            lang,
            formTemplate,
            translations,
            identifiers,
            notes
        } = req.body;

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const currentUserId = req.body?.userId || (req as any).user?.id;

        try {
            if (mode === 'delete' && (name || id)) {
                const placeToDelete = await prisma.place.findFirst({
                    where: id
                        ? { id, treeId: tree.id }
                        : { treeId: tree.id, name: name, parentId: null }
                });
                if (placeToDelete) {
                    const [eventCount, factCount, associationCount, childCount] = await Promise.all([
                        prisma.event.count({ where: { placeId: placeToDelete.id } }),
                        prisma.fact.count({ where: { placeId: placeToDelete.id } }),
                        prisma.association.count({ where: { placeId: placeToDelete.id } }),
                        prisma.place.count({ where: { parentId: placeToDelete.id } })
                    ]);
                    const totalLinks = eventCount + factCount + associationCount;

                    if ((totalLinks > 0 || childCount > 0) && !reassignToId) {
                        return res.status(409).json({
                            success: false,
                            message: 'Place is still in use. Provide reassignToId or merge first.',
                            usage: { eventCount, factCount, associationCount, childCount, totalLinks }
                        });
                    }

                    if (reassignToId) {
                        const target = await prisma.place.findFirst({ where: { id: reassignToId, treeId: tree.id } });
                        if (!target) {
                            return res.status(400).json({ success: false, message: 'Invalid reassignToId' });
                        }
                        if (target.id === placeToDelete.id) {
                            return res.status(400).json({ success: false, message: 'reassignToId must differ from deleting place' });
                        }

                        await prisma.$transaction(async (tx) => {
                            await tx.event.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                            await tx.fact.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                            await tx.association.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                            await tx.place.updateMany({ where: { parentId: placeToDelete.id }, data: { parentId: target.id } });
                            await tx.place.delete({ where: { id: placeToDelete.id } });
                        });
                    } else {
                        await prisma.place.delete({ where: { id: placeToDelete.id } });
                    }

                    await prisma.changeLog.create({
                        data: {
                            treeId: tree.id,
                            action: 'DELETE',
                            entityType: 'PLACE',
                            entityId: placeToDelete.id,
                            before: placeToDelete as any,
                            summary: `Ort ${placeToDelete.name} gelöscht`
                        }
                    });
                }
                return res.json({ success: true });
            }

            const lat = (latitude !== undefined && latitude !== '') ? parseFloat(latitude) : null;
            const lng = (longitude !== undefined && longitude !== '') ? parseFloat(longitude) : null;
            const normalizedParentId = parentId || null;
            const normalizedHistoricNames = Array.isArray(historicNames)
                ? historicNames.filter((h: any) => typeof h === 'string' && h.trim()).map((h: string) => h.trim())
                : (typeof historicNames === 'string'
                    ? historicNames.split(',').map((h) => h.trim()).filter(Boolean)
                    : []);

            if (normalizedParentId) {
                const parent = await prisma.place.findFirst({ where: { id: normalizedParentId, treeId: tree.id } });
                if (!parent) {
                    return res.status(400).json({ success: false, message: 'Invalid parentId for this tree.' });
                }
                if (id && normalizedParentId === id) {
                    return res.status(400).json({ success: false, message: 'A place cannot be its own parent.' });
                }
            }

            let beforeState = null;
            let action: 'CREATE' | 'UPDATE' = 'CREATE';
            let targetPlaceId: string | null = null;

            if (id) {
                beforeState = await prisma.place.findFirst({ where: { id, treeId: tree.id } });
                if (!beforeState) {
                    return res.status(404).json({ success: false, message: 'Place not found.' });
                }
                const p = await prisma.place.update({
                    where: { id: beforeState.id },
                    data: {
                        name: name,
                        latitude: lat,
                        longitude: lng,
                        jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames,
                        parentId: normalizedParentId,
                        form: form || null,
                        phrase: phrase || null,
                        level: level || 'CITY',
                        lang: lang || null,
                        formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = p.id;
                action = 'UPDATE';
            } else if (old_name && old_name !== name) {
                beforeState = await prisma.place.findFirst({
                    where: { treeId: tree.id, name: old_name, parentId: null }
                });
                if (beforeState) {
                    const p = await prisma.place.update({
                        where: { id: beforeState.id },
                        data: {
                            name: name,
                            latitude: lat,
                            longitude: lng,
                            jurisdiction: jurisdiction || null,
                            historicNames: normalizedHistoricNames,
                            form: form || null,
                            phrase: phrase || null,
                            level: level || 'CITY',
                            lang: lang || null,
                            formTemplate: formTemplate || null
                        }
                    });
                    targetPlaceId = p.id;
                    action = 'UPDATE';
                }
            } else {
                const existingPlace = await prisma.place.findFirst({
                    where: { treeId: tree.id, name: name, parentId: normalizedParentId }
                });
                if (existingPlace) {
                    beforeState = existingPlace;
                    const p = await prisma.place.update({
                        where: { id: existingPlace.id },
                        data: {
                            latitude: lat,
                            longitude: lng,
                            jurisdiction: jurisdiction || null,
                            historicNames: normalizedHistoricNames,
                            form: form || null,
                            phrase: phrase || null,
                            level: level || 'CITY',
                            lang: lang || null,
                            formTemplate: formTemplate || null
                        }
                    });
                    targetPlaceId = p.id;
                    action = 'UPDATE';
                } else {
                    const p = await prisma.place.create({
                        data: {
                            treeId: tree.id,
                            name: name,
                            historicNames: normalizedHistoricNames,
                            jurisdiction: jurisdiction || null,
                            parentId: normalizedParentId,
                            latitude: lat,
                            longitude: lng,
                            form: form || null,
                            phrase: phrase || null,
                            level: level || 'CITY',
                            lang: lang || null,
                            formTemplate: formTemplate || null
                        }
                    });
                    targetPlaceId = p.id;
                    action = 'CREATE';
                }
            }

            if (targetPlaceId) {
                if (translations && Array.isArray(translations)) {
                    await prisma.placeTranslation.deleteMany({ where: { placeId: targetPlaceId } });
                    for (const tr of translations) {
                        if (!tr.name) continue;
                        await prisma.placeTranslation.create({
                            data: {
                                placeId: targetPlaceId,
                                name: tr.name,
                                lang: tr.lang || '',
                                form: tr.form || null,
                                dateStart: tr.dateStart ? new Date(tr.dateStart) : null,
                                dateEnd: tr.dateEnd ? new Date(tr.dateEnd) : null,
                                dateType: tr.dateType || 'EXACT'
                            }
                        });
                    }
                }

                if (identifiers && Array.isArray(identifiers)) {
                    await prisma.identifier.deleteMany({ where: { placeId: targetPlaceId } });
                    for (const iden of identifiers) {
                        if (!iden.value) continue;
                        await prisma.identifier.create({
                            data: {
                                treeId: tree.id,
                                placeId: targetPlaceId,
                                entityType: 'PLACE',
                                entityId: targetPlaceId,
                                value: iden.value,
                                type: iden.type || 'OTHER'
                            }
                        });
                    }
                }

                if (notes && Array.isArray(notes)) {
                    await prisma.noteLink.deleteMany({ where: { placeId: targetPlaceId } });
                    for (const noteData of notes) {
                        const isString = typeof noteData === 'string';
                        const noteText = isString ? noteData : (noteData?.text || '');
                        if (!noteText.trim()) continue;

                        const noteType = isString ? 'OTHER' : (noteData?.noteType || 'OTHER');
                        const pLevel = (!isString && noteData?.isPrivate) ? 'PRIVATE' : 'PUBLIC';
                        
                        let note;
                        if (!isString && noteData?.id && !noteData.id.startsWith('note-')) {
                            note = await prisma.sharedNote.findUnique({ where: { id: noteData.id } });
                            if (note) {
                                note = await prisma.sharedNote.update({
                                    where: { id: note.id },
                                    data: { text: noteText, noteType, privacyLevel: pLevel as any }
                                });
                            }
                        }
                        
                        if (!note) {
                            note = await prisma.sharedNote.create({
                                data: {
                                    treeId: tree.id,
                                    text: noteText,
                                    noteType,
                                    privacyLevel: pLevel as any,
                                    userId: currentUserId || null
                                }
                            });
                        }
                        
                        await prisma.noteLink.create({
                            data: {
                                treeId: tree.id,
                                placeId: targetPlaceId,
                                noteId: note.id
                            }
                        });
                    }
                }

                const afterState = await prisma.place.findUnique({ where: { id: targetPlaceId } });
                await prisma.changeLog.create({
                    data: {
                        treeId: tree.id,
                        action: action,
                        entityType: 'PLACE',
                        entityId: targetPlaceId,
                        before: beforeState as any,
                        after: afterState as any,
                        summary: `Ort ${name} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`
                    }
                });
            }

            res.json({ success: true });
        } catch (error: any) {
            console.error('Place save error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
