import { PrismaClient } from '@prisma/client';
import { NotesService } from './notes.service';

export class SourceService {
    private notesService: NotesService;

    constructor(private prisma: PrismaClient) {
        this.notesService = new NotesService(prisma);
    }

    async getSources(treeId: string) {
        const sources = await this.prisma.source.findMany({
            where: { treeId },
            include: {
                repository: { select: { id: true, name: true } },
                _count: { select: { citations: true, mediaLinks: true, noteLinks: true } }
            },
            orderBy: { title: 'asc' }
        });

        return sources.map(s => ({
            id: s.id,
            title: s.title,
            shortTitle: s.shortTitle,
            author: s.author,
            publication: s.publication,
            sourceType: s.sourceType,
            category: s.category,
            repositoryId: s.repositoryId,
            repositoryName: s.repository?.name || null,
            usageCount: s._count.citations + s._count.mediaLinks + s._count.noteLinks
        }));
    }

    async getSourceById(treeId: string, id: string) {
        const source = await this.prisma.source.findFirst({
            where: { id, treeId },
            include: {
                repository: { select: { id: true, name: true } },
                noteLinks: {
                    include: {
                        note: {
                            include: {
                                createdBy: { select: { id: true, username: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!source) return null;

        return {
            ...source,
            notes: (source.noteLinks || []).map((nl: any) => ({
                id: nl.note.id,
                text: nl.note.text,
                noteType: nl.note.noteType,
                privacyLevel: nl.note.privacyLevel,
                createdAt: nl.note.createdAt,
                updatedAt: nl.note.updatedAt,
                createdBy: nl.note.createdBy ? {
                    id: nl.note.createdBy.id,
                    username: nl.note.createdBy.username
                } : null
            }))
        };
    }

    async getSourceUsage(treeId: string, id: string) {
        const source = await this.prisma.source.findFirst({ where: { id, treeId } });
        if (!source) throw new Error('Source not found');

        const citations = await this.prisma.citation.findMany({
            where: { sourceId: id },
            include: {
                person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                family: true,
                event: { include: { person: { include: { names: { where: { isPrimary: true }, take: 1 } } }, family: true } },
                fact: { include: { person: { include: { names: { where: { isPrimary: true }, take: 1 } } }, family: true } },
                media: true,
                note: true,
                association: { include: { person: { include: { names: { where: { isPrimary: true }, take: 1 } } } } }
            },
            orderBy: { dateText: 'desc' }
        });

        const personLabel = (p: any) =>
            p ? `${p.names?.[0]?.given || ''} ${p.names?.[0]?.surname || ''}`.trim() || p.gedcomId || p.id : null;

        return {
            citations: citations.map(c => {
                let context = 'Unknown';
                let contextLabel = 'Unknown';
                let entityId = null;
                let entityType = null;

                if (c.person) { 
                    context = 'Person'; 
                    contextLabel = personLabel(c.person); 
                    entityId = c.person.id;
                    entityType = 'person';
                }
                else if (c.family) { 
                    context = 'Family'; 
                    contextLabel = c.family.gedcomId || c.family.id; 
                    entityId = c.family.id;
                    entityType = 'family';
                }
                else if (c.event) { 
                    context = `Event (${c.event.type})`; 
                    contextLabel = personLabel(c.event.person) || c.event.family?.gedcomId || 'Unknown'; 
                    entityId = c.event.personId || c.event.familyId || null;
                    entityType = c.event.personId ? 'person' : (c.event.familyId ? 'family' : null);
                }
                else if (c.fact) { 
                    context = `Fact (${c.fact.type})`; 
                    contextLabel = personLabel(c.fact.person) || c.fact.family?.gedcomId || 'Unknown'; 
                    entityId = c.fact.personId || c.fact.familyId || null;
                    entityType = c.fact.personId ? 'person' : (c.fact.familyId ? 'family' : null);
                }
                else if (c.media) { 
                    context = 'Media'; 
                    contextLabel = c.media.title || c.media.path || c.media.id; 
                    entityId = c.media.id;
                    entityType = 'media';
                }
                else if (c.note) { 
                    context = 'Note'; 
                    contextLabel = c.note.text.substring(0, 30) + '...'; 
                    entityId = c.note.id;
                    entityType = 'note';
                }
                else if (c.association) { 
                    context = `Association (${c.association.role})`; 
                    contextLabel = personLabel(c.association.person); 
                    entityId = c.association.personId;
                    entityType = 'person';
                }

                return {
                    id: c.id,
                    context,
                    contextLabel,
                    entityId,
                    entityType,
                    page: c.page,
                    dateText: c.dateText,
                    confidence: c.confidence
                };
            }),
            totalLinks: citations.length
        };
    }

    async mergeSources(treeId: string, sourceId: string, targetId: string) {
        const [source, target] = await Promise.all([
            this.prisma.source.findFirst({ where: { id: sourceId, treeId } }),
            this.prisma.source.findFirst({ where: { id: targetId, treeId } })
        ]);
        if (!source || !target) throw new Error('Source or target not found');

        return this.prisma.$transaction(async (tx) => {
            await tx.citation.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
            await tx.noteLink.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
            await tx.mediaLink.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
            await tx.source.delete({ where: { id: source.id } });
            return true;
        });
    }

    async saveSource(treeId: string, data: any, currentUserId?: string) {
        const { id, title, shortTitle, author, publication, sourceType, category, repositoryId, notes } = data;

        if (!title) throw new Error('Title is required');

        const sourceData = {
            title,
            shortTitle: shortTitle || null,
            author: author || null,
            publication: publication || null,
            sourceType: sourceType || null,
            category: category || null,
            repositoryId: repositoryId || null
        };

        return this.prisma.$transaction(async (tx) => {
            let resultSource;
            if (id) {
                const existing = await tx.source.findFirst({ where: { id, treeId } });
                if (!existing) throw new Error('Source not found');
                resultSource = await tx.source.update({ where: { id }, data: sourceData });
            } else {
                resultSource = await tx.source.create({
                    data: { ...sourceData, treeId }
                });
            }

            if (notes && Array.isArray(notes)) {
                await tx.noteLink.deleteMany({ where: { sourceId: resultSource.id } });
                await this.notesService.processSharedNotes(tx as any, treeId, notes, { sourceId: resultSource.id }, currentUserId);
            }

            return resultSource;
        });
    }

    async deleteSource(treeId: string, id: string, reassignToId?: string) {
        const sourceToDelete = await this.prisma.source.findFirst({ where: { id, treeId } });
        if (!sourceToDelete) throw new Error('Source not found');

        const [citationCount, mediaLinkCount, noteLinkCount] = await Promise.all([
            this.prisma.citation.count({ where: { sourceId: sourceToDelete.id } }),
            this.prisma.mediaLink.count({ where: { sourceId: sourceToDelete.id } }),
            this.prisma.noteLink.count({ where: { sourceId: sourceToDelete.id } })
        ]);
        const totalLinks = citationCount + mediaLinkCount + noteLinkCount;

        if (totalLinks > 0 && !reassignToId) {
            return {
                inUse: true,
                usageCount: { citationCount, mediaLinkCount, noteLinkCount, totalLinks }
            };
        }

        if (reassignToId) {
            const target = await this.prisma.source.findFirst({ where: { id: reassignToId, treeId } });
            if (!target) throw new Error('Invalid reassignToId');
            if (target.id === sourceToDelete.id) throw new Error('reassignToId must differ from deleting source');

            await this.prisma.$transaction(async (tx) => {
                await tx.citation.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                await tx.noteLink.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                await tx.mediaLink.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                await tx.source.delete({ where: { id: sourceToDelete.id } });
            });
        } else {
            await this.prisma.source.delete({ where: { id: sourceToDelete.id } });
        }

        return { deleted: true };
    }
}
