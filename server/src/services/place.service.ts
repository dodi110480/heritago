import { PrismaClient } from '@prisma/client';

export class PlaceService {
    constructor(private prisma: PrismaClient) {}

    async mergePlaces(treeId: string, sourceId: string, targetId: string) {
        if (!sourceId || !targetId || sourceId === targetId) {
            throw new Error('sourceId and targetId required and must differ');
        }

        const [source, target] = await Promise.all([
            this.prisma.place.findFirst({ where: { id: sourceId, treeId } }),
            this.prisma.place.findFirst({ where: { id: targetId, treeId } })
        ]);

        if (!source || !target) {
            throw new Error('Source or target not found');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.event.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
            await tx.fact.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
            await tx.association.updateMany({ where: { placeId: source.id }, data: { placeId: target.id } });
            await tx.place.updateMany({ where: { parentId: source.id }, data: { parentId: target.id } });
            await tx.place.delete({ where: { id: source.id } });
        });

        await this.prisma.changeLog.create({
            data: {
                treeId,
                action: 'UPDATE',
                entityType: 'PLACE',
                entityId: target.id,
                summary: `Ort ${source.name} in ${target.name} zusammengeführt`
            }
        });
    }

    async getPlaces(treeId: string) {
        const places = await this.prisma.place.findMany({
            where: { treeId },
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

        return places.map(p => ({
            ...p,
            usage: {
                eventCount: p._count.events,
                factCount: p._count.facts,
                associationCount: p._count.associations,
                childCount: p._count.children,
                total: p._count.events + p._count.facts + p._count.associations
            }
        }));
    }

    async searchPlaces(treeId: string, query: string) {
        if (!query) return [];
        const places = await this.prisma.place.findMany({
            where: {
                treeId,
                name: { contains: query, mode: 'insensitive' }
            },
            take: 10
        });
        return places.map(p => p.name);
    }

    async getPlaceUsage(treeId: string, placeId: string) {
        const [events, facts, children, associations] = await Promise.all([
            this.prisma.event.findMany({
                where: { placeId, treeId },
                include: {
                    person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                    family: true
                }
            }),
            this.prisma.fact.findMany({
                where: { placeId, treeId },
                include: {
                    person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                    family: true
                }
            }),
            this.prisma.place.findMany({
                where: { parentId: placeId, treeId }
            }),
            this.prisma.association.findMany({
                where: { placeId, treeId },
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
                entityType: 'place-detail',
                dateText: null
            });
        }

        return results;
    }

    async getPlaceById(treeId: string, placeId: string) {
        const place = await this.prisma.place.findFirst({
            where: { id: placeId, treeId },
            include: {
                translations: true,
                identifiers: true,
                noteLinks: { include: { note: true } }
            }
        });

        if (!place) throw new Error('Place not found');

        return {
            ...place,
            notes: place.noteLinks.map((nl: any) => ({
                id: nl.note.id,
                text: nl.note.text,
                noteType: nl.note.noteType,
                privacyLevel: nl.note.privacyLevel,
                isPrivate: nl.note.privacyLevel === 'PRIVATE'
            }))
        };
    }

    async savePlace(treeId: string, currentUserId: string | null, data: any) {
        const {
            id, name, old_name, latitude, longitude, mode, jurisdiction,
            historicNames, parentId, reassignToId, form, phrase, level,
            lang, formTemplate, translations, identifiers, notes
        } = data;

        if (mode === 'delete' && (name || id)) {
            return this.deletePlace(treeId, id, name, reassignToId);
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
            const parent = await this.prisma.place.findFirst({ where: { id: normalizedParentId, treeId } });
            if (!parent) throw new Error('Invalid parentId for this tree.');
            if (id && normalizedParentId === id) throw new Error('A place cannot be its own parent.');
        }

        let beforeState = null;
        let action: 'CREATE' | 'UPDATE' = 'CREATE';
        let targetPlaceId: string | null = null;
        let p: any;

        if (id) {
            beforeState = await this.prisma.place.findFirst({ where: { id, treeId } });
            if (!beforeState) throw new Error('Place not found.');
            p = await this.prisma.place.update({
                where: { id: beforeState.id },
                data: {
                    name, latitude: lat, longitude: lng, jurisdiction: jurisdiction || null,
                    historicNames: normalizedHistoricNames, parentId: normalizedParentId,
                    form: form || null, phrase: phrase || null, level: level || 'CITY',
                    lang: lang || null, formTemplate: formTemplate || null
                }
            });
            targetPlaceId = p.id;
            action = 'UPDATE';
        } else if (old_name && old_name !== name) {
            beforeState = await this.prisma.place.findFirst({
                where: { treeId, name: old_name, parentId: null }
            });
            if (beforeState) {
                p = await this.prisma.place.update({
                    where: { id: beforeState.id },
                    data: {
                        name, latitude: lat, longitude: lng, jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames, form: form || null,
                        phrase: phrase || null, level: level || 'CITY',
                        lang: lang || null, formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = p.id;
                action = 'UPDATE';
            }
        } else {
            const existingPlace = await this.prisma.place.findFirst({
                where: { treeId, name, parentId: normalizedParentId }
            });
            if (existingPlace) {
                beforeState = existingPlace;
                p = await this.prisma.place.update({
                    where: { id: existingPlace.id },
                    data: {
                        latitude: lat, longitude: lng, jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames, form: form || null,
                        phrase: phrase || null, level: level || 'CITY',
                        lang: lang || null, formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = p.id;
                action = 'UPDATE';
            } else {
                p = await this.prisma.place.create({
                    data: {
                        treeId, name, historicNames: normalizedHistoricNames,
                        jurisdiction: jurisdiction || null, parentId: normalizedParentId,
                        latitude: lat, longitude: lng, form: form || null,
                        phrase: phrase || null, level: level || 'CITY',
                        lang: lang || null, formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = p.id;
                action = 'CREATE';
            }
        }

        if (targetPlaceId) {
            await this.updateSubEntities(treeId, currentUserId, targetPlaceId, translations, identifiers, notes);

            const afterState = await this.prisma.place.findUnique({ where: { id: targetPlaceId } });
            await this.prisma.changeLog.create({
                data: {
                    treeId,
                    action: action,
                    entityType: 'PLACE',
                    entityId: targetPlaceId,
                    before: beforeState as any,
                    after: afterState as any,
                    summary: `Ort ${name} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`
                }
            });
        }
        
        return p;
    }

    private async deletePlace(treeId: string, id: string | undefined, name: string | undefined, reassignToId: string | undefined) {
        const placeToDelete = await this.prisma.place.findFirst({
            where: id ? { id, treeId } : { treeId, name: name, parentId: null }
        });

        if (!placeToDelete) return;

        const [eventCount, factCount, associationCount, childCount] = await Promise.all([
            this.prisma.event.count({ where: { placeId: placeToDelete.id } }),
            this.prisma.fact.count({ where: { placeId: placeToDelete.id } }),
            this.prisma.association.count({ where: { placeId: placeToDelete.id } }),
            this.prisma.place.count({ where: { parentId: placeToDelete.id } })
        ]);
        const totalLinks = eventCount + factCount + associationCount;

        if ((totalLinks > 0 || childCount > 0) && !reassignToId) {
            const err: any = new Error('Place is still in use. Provide reassignToId or merge first.');
            err.usage = { eventCount, factCount, associationCount, childCount, totalLinks };
            err.statusCode = 409;
            throw err;
        }

        if (reassignToId) {
            const target = await this.prisma.place.findFirst({ where: { id: reassignToId, treeId } });
            if (!target) {
                const err: any = new Error('Invalid reassignToId');
                err.statusCode = 400;
                throw err;
            }
            if (target.id === placeToDelete.id) {
                const err: any = new Error('reassignToId must differ from deleting place');
                err.statusCode = 400;
                throw err;
            }

            await this.prisma.$transaction(async (tx) => {
                await tx.event.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                await tx.fact.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                await tx.association.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                await tx.place.updateMany({ where: { parentId: placeToDelete.id }, data: { parentId: target.id } });
                await tx.place.delete({ where: { id: placeToDelete.id } });
            });
        } else {
            await this.prisma.place.delete({ where: { id: placeToDelete.id } });
        }

        await this.prisma.changeLog.create({
            data: {
                treeId,
                action: 'DELETE',
                entityType: 'PLACE',
                entityId: placeToDelete.id,
                before: placeToDelete as any,
                summary: `Ort ${placeToDelete.name} gelöscht`
            }
        });
    }

    private async updateSubEntities(treeId: string, currentUserId: string | null, targetPlaceId: string, translations: any, identifiers: any, notes: any) {
        if (translations && Array.isArray(translations)) {
            await this.prisma.placeTranslation.deleteMany({ where: { placeId: targetPlaceId } });
            for (const tr of translations) {
                if (!tr.name) continue;
                await this.prisma.placeTranslation.create({
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
            await this.prisma.identifier.deleteMany({ where: { placeId: targetPlaceId } });
            for (const iden of identifiers) {
                if (!iden.value) continue;
                await this.prisma.identifier.create({
                    data: {
                        treeId,
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
            await this.prisma.noteLink.deleteMany({ where: { placeId: targetPlaceId } });
            for (const noteData of notes) {
                const isString = typeof noteData === 'string';
                const noteText = isString ? noteData : (noteData?.text || '');
                if (!noteText.trim()) continue;

                const noteType = isString ? 'OTHER' : (noteData?.noteType || 'OTHER');
                const pLevel = (!isString && noteData?.isPrivate) ? 'PRIVATE' : 'PUBLIC';
                
                let note;
                if (!isString && noteData?.id && !noteData.id.startsWith('note-')) {
                    note = await this.prisma.sharedNote.findUnique({ where: { id: noteData.id } });
                    if (note) {
                        note = await this.prisma.sharedNote.update({
                            where: { id: note.id },
                            data: { text: noteText, noteType, privacyLevel: pLevel as any }
                        });
                    }
                }
                
                if (!note) {
                    note = await this.prisma.sharedNote.create({
                        data: {
                            treeId,
                            text: noteText,
                            noteType,
                            privacyLevel: pLevel as any,
                            userId: currentUserId || null
                        }
                    });
                }
                
                await this.prisma.noteLink.create({
                    data: {
                        treeId,
                        placeId: targetPlaceId,
                        noteId: note.id
                    }
                });
            }
        }
    }
}
