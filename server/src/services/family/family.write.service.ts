// server/src/services/family/family.write.service.ts
import { FamilyRepository } from '../../repositories/family.repository';
import { IAuditService } from '../../interfaces/audit.service.interface';
import { NotesService } from '../notes.service';

/** `Event.type` values accepted by the Prisma enum – anything else falls back to OTHER. */
const EVENT_TYPES = new Set([
    'BIRT', 'CHR', 'BAPM', 'DEAT', 'BURI', 'CREM', 'MARR', 'DIV', 'ANUL', 'ENGA', 'ADOP',
    'BARM', 'BASM', 'BLES', 'CHRA', 'CONF', 'FCOM', 'ORDN', 'NATU', 'EMIG', 'IMMI', 'CENS',
    'PROB', 'WILL', 'GRAD', 'RETI', 'EVEN', 'BAPL', 'CONL', 'ENDL', 'SLGC', 'SLGS', 'RESI',
    'MILI', 'CAST', 'DSCR', 'OTHER'
]);

export class FamilyWriteService {
    private notesService: NotesService;

    constructor(
        private familyRepository: FamilyRepository,
        private auditService: IAuditService
    ) {
        this.notesService = new NotesService(this.familyRepository.client);
    }

    /**
     * Saves a family together with every nested collection the UI can edit
     * (members, events, notes, citations, media).
     *
     * The write service owns the relation sync – the repository only persists
     * scalar columns, because relation arrays pushed into `family.upsert()` made
     * the whole save fail (see `FamilyRepository.saveFamily`).
     */
    async saveFamily(treeId: string, data: any, userId?: string) {
        const familyId = String(data?.id || '').trim();
        if (!familyId) {
            throw this.httpError(400, 'FAMILY_ID_REQUIRED', 'Für das Speichern einer Familie ist eine ID erforderlich.');
        }

        const husbandId = (data.husband || '').trim();
        const wifeId = (data.wife || '').trim();
        const childIds: string[] = Array.isArray(data.children)
            ? Array.from(new Set(data.children.map((c: any) => (c || '').trim()).filter(Boolean)))
            : [];

        // Validate that spouses are not the same person
        if (husbandId && wifeId && husbandId === wifeId) {
            throw this.httpError(400, 'FAMILY_SPOUSE_CONFLICT', 'Partner und Partnerin dürfen nicht dieselbe Person sein.');
        }
        if (husbandId && childIds.includes(husbandId)) {
            throw this.httpError(400, 'FAMILY_CHILD_CONFLICT', 'Ein Partner kann nicht gleichzeitig Kind derselben Familie sein.');
        }
        if (wifeId && childIds.includes(wifeId)) {
            throw this.httpError(400, 'FAMILY_CHILD_CONFLICT', 'Ein Partner kann nicht gleichzeitig Kind derselben Familie sein.');
        }

        const saved = await this.familyRepository.client.$transaction(async (tx: any) => {
            // Tenant isolation: never touch a family outside the requested tree.
            const existingFamily = await tx.family.findFirst({
                where: { id: familyId, treeId },
                select: { id: true }
            });
            if (!existingFamily) {
                throw this.httpError(404, 'FAMILY_NOT_FOUND', 'Die Familie wurde nicht gefunden.');
            }

            // 1. Save / Upsert the family entity itself (scalar columns only)
            const result = await this.familyRepository.saveFamily({ ...data, treeId }, tx);

            // 2. Sync Family Members
            await this.familyRepository.deleteMembers(result.id, tx);

            const memberCreates: any[] = [];
            const seenPersonIds = new Set<string>();

            const addMember = (pId: string, role: string, sortOrder: number) => {
                if (!pId || seenPersonIds.has(pId)) return;
                memberCreates.push({
                    familyId: result.id,
                    personId: pId,
                    role: role,
                    sortOrder: sortOrder
                });
                seenPersonIds.add(pId);
            };

            if (husbandId) addMember(husbandId, 'SPOUSE', 0);
            if (wifeId) addMember(wifeId, 'SPOUSE', 1);
            childIds.forEach((cId, idx) => addMember(cId, 'CHILD', 100 + idx));

            if (memberCreates.length > 0) {
                await this.familyRepository.createManyMembers(memberCreates, tx);
            }

            // 3. Sync nested collections (only when the client sent them)
            if (data.events !== undefined) {
                await this.syncEvents(tx, treeId, result.id, data.events, userId);
            }
            if (data.notes !== undefined) {
                await this.notesService.processSharedNotes(tx, treeId, data.notes, { familyId: result.id }, userId);
            }
            if (data.citations !== undefined) {
                await this.replaceCitations(tx, treeId, { familyId: result.id }, data.citations, userId);
            }
            if (data.media !== undefined) {
                await this.replaceMediaLinks(tx, treeId, { familyId: result.id }, data.media);
            }

            return result;
        });

        // 4. Audit Logging
        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                data.id ? 'UPDATE' : 'CREATE',
                'FAMILY',
                saved.id,
                { before: data.beforeState }
            );
        }

        return saved;
    }


    /**
     * Reconciles the family's events with the incoming list: existing rows are
     * updated, new ones created and events removed in the UI are deleted.
     */
    private async syncEvents(tx: any, treeId: string, familyId: string, events: any, userId?: string) {
        const incoming = Array.isArray(events) ? events : [];
        const existing = await tx.event.findMany({ where: { familyId }, select: { id: true } });
        const existingIds = new Set<string>(existing.map((event: any) => event.id));

        const keptIds: string[] = [];

        for (const [index, draft] of incoming.entries()) {
            const rawType = String(draft?.type || 'OTHER').toUpperCase();
            const scalars = {
                type: EVENT_TYPES.has(rawType) ? rawType : 'OTHER',
                eventSubtype: draft?.eventSubtype || draft?.subType || null,
                dateText: draft?.dateText || null,
                placeId: await this.resolvePlaceId(tx, treeId, draft?.place, draft?.placeId),
                description: draft?.description || null,
                sortOrder: index
            };

            const eventId = typeof draft?.id === 'string' && existingIds.has(draft.id) ? draft.id : null;
            let savedId: string;

            if (eventId) {
                await tx.event.update({ where: { id: eventId }, data: scalars });
                savedId = eventId;
            } else {
                const created = await tx.event.create({ data: { ...scalars, treeId, familyId } });
                savedId = created.id;
            }

            keptIds.push(savedId);

            if (draft?.notes !== undefined) {
                await this.notesService.processSharedNotes(tx, treeId, draft.notes, { eventId: savedId }, userId);
            }
            if (draft?.citations !== undefined) {
                await this.replaceCitations(tx, treeId, { eventId: savedId }, draft.citations, userId);
            }
            if (draft?.media !== undefined) {
                await this.replaceEventMediaLinks(tx, treeId, savedId, draft.media);
            }
        }

        const staleIds = [...existingIds].filter(id => !keptIds.includes(id));
        if (staleIds.length === 0) return;

        await tx.citation.deleteMany({ where: { eventId: { in: staleIds } } });
        await tx.noteLink.deleteMany({ where: { eventId: { in: staleIds } } });
        await tx.mediaLink.deleteMany({ where: { eventId: { in: staleIds } } });
        await tx.event.deleteMany({ where: { id: { in: staleIds } } });
    }

    /**
     * Replaces the citations of the given owner (family or event).
     * Citations require a source – entries without one cannot be stored.
     */
    private async replaceCitations(
        tx: any,
        treeId: string,
        owner: { familyId?: string; eventId?: string },
        citations: any,
        userId?: string
    ) {
        await tx.citation.deleteMany({ where: { ...owner } });
        if (!Array.isArray(citations)) return;

        for (const citation of citations) {
            if (!citation?.sourceId) continue;

            const created = await tx.citation.create({
                data: {
                    treeId,
                    ...owner,
                    sourceId: citation.sourceId,
                    page: citation.page || citation.whereInSource || null,
                    dateText: citation.dateText || citation.date || null,
                    confidence: citation.confidence || null,
                    citationTexts: (citation.text || citation.dataText)
                        ? { create: [{ text: citation.text || citation.dataText }] }
                        : undefined
                }
            });

            if (Array.isArray(citation.notes)) {
                await this.notesService.processSharedNotes(tx, treeId, citation.notes, { citationId: created.id }, userId);
            }
        }
    }

    /** Replaces the family's media links, keeping only media of this tree. */
    private async replaceMediaLinks(tx: any, treeId: string, owner: { familyId: string }, media: any) {
        await tx.mediaLink.deleteMany({ where: { ...owner } });
        const knownIds = await this.knownMediaIds(tx, treeId, media);

        for (const item of Array.isArray(media) ? media : []) {
            if (!knownIds.has(item?.id)) continue;
            await tx.mediaLink.create({
                data: { treeId, ...owner, mediaId: item.id, isPrimary: !!item.isPrimary }
            });
        }
    }

    /** Replaces the media links of a single event. */
    private async replaceEventMediaLinks(tx: any, treeId: string, eventId: string, media: any) {
        await tx.mediaLink.deleteMany({ where: { eventId } });
        const knownIds = await this.knownMediaIds(tx, treeId, media);

        for (const item of Array.isArray(media) ? media : []) {
            if (!knownIds.has(item?.id)) continue;
            await tx.mediaLink.create({
                data: { treeId, eventId, mediaId: item.id, isPrimary: !!item.isPrimary }
            });
        }
    }

    /** Incoming media ids that really exist in this tree (tenant isolation). */
    private async knownMediaIds(tx: any, treeId: string, media: any): Promise<Set<string>> {
        const requestedIds = (Array.isArray(media) ? media : [])
            .map((item: any) => (typeof item?.id === 'string' ? item.id : null))
            .filter((id: string | null): id is string => !!id);

        if (requestedIds.length === 0) return new Set<string>();

        const known = await tx.media.findMany({
            where: { id: { in: requestedIds }, treeId },
            select: { id: true }
        });

        return new Set<string>(known.map((row: any) => row.id));
    }

    /** Resolves a place name to a `Place` row of the tree, creating it if needed. */
    private async resolvePlaceId(tx: any, treeId: string, rawPlaceName?: string | null, currentPlaceId?: string | null) {
        const placeName = String(rawPlaceName || '').trim();
        if (!placeName) return currentPlaceId || null;

        if (currentPlaceId) {
            const current = await tx.place.findFirst({ where: { id: currentPlaceId, treeId } });
            if (current?.name === placeName) return current.id;
        }

        let place = await tx.place.findFirst({ where: { treeId, name: placeName, parentId: null } });
        if (!place) {
            place = await tx.place.create({ data: { treeId, name: placeName, historicNames: [] } });
        }

        return place.id;
    }

    /** Error carrying HTTP status + API error code (see `.clinerules/api.md`). */
    private httpError(status: number, code: string, message: string) {
        const error: any = new Error(message);
        error.statusCode = status;
        error.code = code;
        return error;
    }

    async deleteFamily(id: string, treeId: string, userId?: string) {
        const result = await this.familyRepository.deleteFamily(id, treeId);
        
        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                'DELETE',
                'FAMILY',
                id
            );
        }
        
        return result;
    }
}
