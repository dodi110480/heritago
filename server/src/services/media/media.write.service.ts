// server/src/services/media/media.write.service.ts
import { MediaRepository } from '../../repositories/media.repository';
import { IAuditService } from '../../interfaces/audit.service.interface';
import { MediaFormatter } from '../../shared/formatters/media.formatter';
import { NotesService } from '../notes.service';

/**
 * Scalar `Media` columns the API is allowed to write.
 *
 * Everything else is either server-owned (id, treeId, userId, version, path,
 * filesize, checksum, crop*, timestamps) or a relation (`identifiers`, `notes`,
 * `citations`, `links`, `variants`) that is persisted separately below.
 * Passing raw relation arrays into a Prisma scalar write made every save fail.
 */
const MEDIA_SCALAR_FIELDS = [
    'title',
    'mediaType',
    'gedcomId',
    'remoteUrl',
    'mimeType',
    'dimensions',
    'fileFormat',
    'sortOrder',
    'chanDate',
    'extensions'
] as const;

export class MediaWriteService {
    constructor(
        private mediaRepository: MediaRepository,
        private auditService: IAuditService,
        private notesService: NotesService
    ) {}

    async saveMedia(treeId: string, data: any, userId?: string) {
        const id = typeof data?.id === 'string' ? data.id : '';
        const scalars = this.pickScalarFields(data);

        const saved = await this.mediaRepository.client.$transaction(async (tx: any) => {
            let media: any;

            if (id) {
                // Tenant isolation: never touch a media row outside the requested tree.
                const existing = await tx.media.findFirst({
                    where: { id, treeId },
                    select: { id: true }
                });
                if (!existing) {
                    throw this.httpError(404, 'MEDIA_NOT_FOUND', 'Das Medium wurde nicht gefunden.');
                }
                media = await tx.media.update({ where: { id: existing.id }, data: scalars });
            } else {
                media = await tx.media.create({ data: { ...scalars, treeId } });
            }

            if (data.identifiers !== undefined) {
                await this.replaceIdentifiers(tx, treeId, media.id, data.identifiers);
            }

            if (data.notes !== undefined) {
                await this.notesService.processSharedNotes(tx, treeId, data.notes, { mediaId: media.id }, userId);
            }

            if (data.citations !== undefined) {
                await this.replaceCitations(tx, treeId, media.id, data.citations, userId);
            }

            return media;
        });

        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                id ? 'UPDATE' : 'CREATE',
                'MEDIA',
                saved.id
            );
        }

        // Re-read so the response carries the freshly written relations.
        const fresh = await this.mediaRepository.findById(saved.id, treeId);
        return MediaFormatter.formatMediaForClient(fresh ?? saved);
    }

    /**
     * Keeps only client-writable scalar columns; drops `undefined` so partial
     * updates do not reset unrelated values.
     */
    private pickScalarFields(data: any): Record<string, any> {
        const scalars: Record<string, any> = {};
        for (const field of MEDIA_SCALAR_FIELDS) {
            if (data?.[field] !== undefined) scalars[field] = data[field];
        }
        return scalars;
    }

    private async replaceIdentifiers(tx: any, treeId: string, mediaId: string, identifiers: any) {
        await tx.identifier.deleteMany({ where: { mediaId } });
        if (!Array.isArray(identifiers)) return;

        for (const identifier of identifiers) {
            if (!identifier?.value) continue;
            await tx.identifier.create({
                data: {
                    treeId,
                    mediaId,
                    entityType: 'MEDIA',
                    entityId: mediaId,
                    type: identifier.type || null,
                    value: identifier.value
                }
            });
        }
    }

    /**
     * Citations arrive with API aliases (`whereInSource`, `date`) as well as raw
     * column names (`page`, `dateText`) – both are accepted, mirroring
     * PersonWriteService.
     */
    private async replaceCitations(tx: any, treeId: string, mediaId: string, citations: any, userId?: string) {
        await tx.citation.deleteMany({ where: { mediaId } });
        if (!Array.isArray(citations)) return;

        for (const citation of citations) {
            if (!citation?.sourceId) continue;

            const created = await tx.citation.create({
                data: {
                    treeId,
                    mediaId,
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

    private httpError(status: number, code: string, message: string) {
        const error: any = new Error(message);
        error.statusCode = status;
        error.code = code;
        return error;
    }

    async deleteMedia(id: string, treeId: string, userId?: string) {
        const result = await this.mediaRepository.deleteMedia(id, treeId);

        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                'DELETE',
                'MEDIA',
                id
            );
        }

        return result;
    }
}
