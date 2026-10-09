// server/src/services/place/place.write.service.ts
import { PlaceRepository } from '../../repositories/place.repository';
import { IAuditService } from '../../interfaces/audit.service.interface';
import { NotesService } from '../notes.service';

export class PlaceWriteService {
    private notesService: NotesService;

    constructor(
        private placeRepository: PlaceRepository,
        private auditService: IAuditService
    ) {
        this.notesService = new NotesService((this.placeRepository as any).prisma);
    }

    async savePlace(treeId: string, data: any, userId?: string) {
        const prisma = (this.placeRepository as any).prisma;

        const {
            id, name, latitude, longitude, jurisdiction,
            historicNames, parentId, form, phrase, level,
            lang, formTemplate, translations, identifiers, notes, old_name
        } = data;

        if (!name || !name.trim()) {
            throw new Error('Name is required.');
        }

        const lat = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
        const lng = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;
        const normalizedParentId = parentId || null;
        const normalizedHistoricNames = Array.isArray(historicNames)
            ? historicNames.filter((h: any) => typeof h === 'string' && h.trim()).map((h: string) => h.trim())
            : (typeof historicNames === 'string'
                ? historicNames.split(',').map((h) => h.trim()).filter(Boolean)
                : []);

        // Validate parent reference (existence + no self-reference)
        if (normalizedParentId) {
            const parent = await prisma.place.findFirst({ where: { id: normalizedParentId, treeId } });
            if (!parent) throw new Error('Invalid parentId for this tree.');
            if (id && normalizedParentId === id) throw new Error('A place cannot be its own parent.');
        }

        return prisma.$transaction(async (tx: any) => {
            let beforeState: any = null;
            let action: 'CREATE' | 'UPDATE' = 'CREATE';
            let targetPlaceId: string | null = null;
            let result: any;

            if (id) {
                beforeState = await tx.place.findFirst({ where: { id, treeId } });
                if (!beforeState) throw new Error('Place not found.');
                result = await tx.place.update({
                    where: { id: beforeState.id },
                    data: {
                        name, latitude: lat, longitude: lng, jurisdiction: jurisdiction || null,
                        historicNames: normalizedHistoricNames, parentId: normalizedParentId,
                        form: form || null, phrase: phrase || null, level: level || 'CITY',
                        lang: lang || null, formTemplate: formTemplate || null
                    }
                });
                targetPlaceId = result.id;
                action = 'UPDATE';
            } else if (old_name && old_name !== name) {
                beforeState = await tx.place.findFirst({
                    where: { treeId, name: old_name, parentId: null }
                });
                if (beforeState) {
                    result = await tx.place.update({
                        where: { id: beforeState.id },
                        data: {
                            name, latitude: lat, longitude: lng, jurisdiction: jurisdiction || null,
                            historicNames: normalizedHistoricNames, form: form || null,
                            phrase: phrase || null, level: level || 'CITY',
                            lang: lang || null, formTemplate: formTemplate || null
                        }
                    });
                    targetPlaceId = result.id;
                    action = 'UPDATE';
                }
            }

            if (!targetPlaceId) {
                const existingPlace = await tx.place.findFirst({
                    where: { treeId, name, parentId: normalizedParentId }
                });
                if (existingPlace) {
                    beforeState = existingPlace;
                    result = await tx.place.update({
                        where: { id: existingPlace.id },
                        data: {
                            latitude: lat, longitude: lng, jurisdiction: jurisdiction || null,
                            historicNames: normalizedHistoricNames, form: form || null,
                            phrase: phrase || null, level: level || 'CITY',
                            lang: lang || null, formTemplate: formTemplate || null
                        }
                    });
                    targetPlaceId = result.id;
                    action = 'UPDATE';
                } else {
                    result = await tx.place.create({
                        data: {
                            treeId, name, historicNames: normalizedHistoricNames,
                            jurisdiction: jurisdiction || null, parentId: normalizedParentId,
                            latitude: lat, longitude: lng, form: form || null,
                            phrase: phrase || null, level: level || 'CITY',
                            lang: lang || null, formTemplate: formTemplate || null
                        }
                    });
                    targetPlaceId = result.id;
                    action = 'CREATE';
                }
            }

            if (targetPlaceId) {
                await this.updateSubEntitiesTransaction(tx, treeId, targetPlaceId, translations, identifiers, notes, userId);

                const afterState = await tx.place.findUnique({ where: { id: targetPlaceId } });
                if (userId) {
                    await this.auditService.logAction(
                        treeId,
                        userId,
                        action,
                        'PLACE',
                        targetPlaceId,
                        {
                            before: beforeState,
                            after: afterState,
                            summary: `Ort ${name} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`
                        }
                    );
                }
            }

            return result;
        });
    }

    async deletePlace(treeId: string, id: string | undefined, name: string | undefined, reassignToId: string | undefined, userId?: string) {
        const prisma = (this.placeRepository as any).prisma;

        const placeToDelete = await prisma.place.findFirst({
            where: id ? { id, treeId } : { treeId, name: name, parentId: null }
        });

        if (!placeToDelete) return null;

        const [eventCount, factCount, associationCount, childCount] = await Promise.all([
            prisma.event.count({ where: { placeId: placeToDelete.id } }),
            prisma.fact.count({ where: { placeId: placeToDelete.id } }),
            prisma.association.count({ where: { placeId: placeToDelete.id } }),
            prisma.place.count({ where: { parentId: placeToDelete.id } })
        ]);
        const totalLinks = eventCount + factCount + associationCount;

        if ((totalLinks > 0 || childCount > 0) && !reassignToId) {
            const err: any = new Error('Place is still in use. Provide reassignToId or merge first.');
            err.statusCode = 409;
            throw err;
        }

        if (reassignToId) {
            const target = await prisma.place.findFirst({ where: { id: reassignToId, treeId } });
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

            await prisma.$transaction(async (tx: any) => {
                await tx.event.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                await tx.fact.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                await tx.association.updateMany({ where: { placeId: placeToDelete.id }, data: { placeId: target.id } });
                await tx.place.updateMany({ where: { parentId: placeToDelete.id }, data: { parentId: target.id } });
                await tx.place.delete({ where: { id: placeToDelete.id } });
            });
        } else {
            await prisma.place.delete({ where: { id: placeToDelete.id } });
        }

        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                'DELETE',
                'PLACE',
                placeToDelete.id,
                { before: placeToDelete, summary: `Ort ${placeToDelete.name} gelöscht` }
            );
        }

        return null;
    }

    private async updateSubEntitiesTransaction(
        tx: any,
        treeId: string,
        targetPlaceId: string,
        translations: any,
        identifiers: any,
        notes: any,
        userId?: string
    ) {
        // --- Translations ---
        if (translations && Array.isArray(translations)) {
            await tx.placeTranslation.deleteMany({ where: { placeId: targetPlaceId } });
            for (const tr of translations) {
                if (!tr.name) continue;
                await tx.placeTranslation.create({
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

        // --- Identifiers ---
        if (identifiers && Array.isArray(identifiers)) {
            await tx.identifier.deleteMany({ where: { placeId: targetPlaceId, entityType: 'PLACE' } });
            for (const iden of identifiers) {
                if (!iden.value) continue;
                await tx.identifier.create({
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

        // --- Notes ---
        if (notes && Array.isArray(notes)) {
            await this.notesService.processSharedNotes(tx, treeId, notes, { placeId: targetPlaceId }, userId);
        }
    }
}
