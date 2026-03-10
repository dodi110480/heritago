import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotesService } from '../services/notes.service';

export const sourceRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });

    router.get('/', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const sources = await prisma.source.findMany({
            where: { treeId: tree.id },
            include: {
                repository: { select: { id: true, name: true } },
                _count: { select: { citations: true, mediaLinks: true, noteLinks: true } }
            },
            orderBy: { title: 'asc' }
        });

        res.json({
            success: true,
            sources: sources.map(s => ({
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
            }))
        });
    });

    router.get('/:id', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { id } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const source = await prisma.source.findFirst({
            where: { id, treeId: tree.id },
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

        if (!source) return res.status(404).json({ success: false, message: 'Source not found' });

        res.json({
            success: true,
            source: {
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
            }
        });
    });

    router.get('/:id/usage', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { id } = req.params;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const source = await prisma.source.findFirst({ where: { id, treeId: tree.id } });
        if (!source) return res.status(404).json({ success: false, message: 'Source not found' });

        const citations = await prisma.citation.findMany({
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

        res.json({
            success: true,
            usage: {
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
            }
        });
    });

    router.post('/merge', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { sourceId, targetId } = req.body;
        if (!sourceId || !targetId || sourceId === targetId) {
            return res.status(400).json({ success: false, message: 'sourceId and targetId required and must differ' });
        }

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

        const [source, target] = await Promise.all([
            prisma.source.findFirst({ where: { id: sourceId, treeId: tree.id } }),
            prisma.source.findFirst({ where: { id: targetId, treeId: tree.id } })
        ]);
        if (!source || !target) return res.status(404).json({ success: false, message: 'Source or target not found' });

        await prisma.$transaction(async (tx) => {
            await tx.citation.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
            await tx.noteLink.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
            await tx.mediaLink.updateMany({ where: { sourceId: source.id }, data: { sourceId: target.id } });
            await tx.source.delete({ where: { id: source.id } });
        });

        res.json({ success: true });
    });

    router.post('/', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { id, title, shortTitle, author, publication, sourceType, category, repositoryId, mode, reassignToId, notes, userId: bodyUserId } = req.body;
        const currentUserId = bodyUserId || (req as any).user?.id;

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });
        
        try {
            if (mode === 'delete' && id) {
                const sourceToDelete = await prisma.source.findFirst({ where: { id, treeId: tree.id } });
                if (sourceToDelete) {
                    const [citationCount, mediaLinkCount, noteLinkCount] = await Promise.all([
                        prisma.citation.count({ where: { sourceId: sourceToDelete.id } }),
                        prisma.mediaLink.count({ where: { sourceId: sourceToDelete.id } }),
                        prisma.noteLink.count({ where: { sourceId: sourceToDelete.id } })
                    ]);
                    const totalLinks = citationCount + mediaLinkCount + noteLinkCount;

                    if (totalLinks > 0 && !reassignToId) {
                        return res.status(409).json({
                            success: false,
                            message: 'Source is still in use. Provide reassignToId or merge first.',
                            usage: { citationCount, mediaLinkCount, noteLinkCount, totalLinks }
                        });
                    }

                    if (reassignToId) {
                        const target = await prisma.source.findFirst({ where: { id: reassignToId, treeId: tree.id } });
                        if (!target) return res.status(400).json({ success: false, message: 'Invalid reassignToId' });
                        if (target.id === sourceToDelete.id) return res.status(400).json({ success: false, message: 'reassignToId must differ from deleting source' });

                        await prisma.$transaction(async (tx) => {
                            await tx.citation.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                            await tx.noteLink.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                            await tx.mediaLink.updateMany({ where: { sourceId: sourceToDelete.id }, data: { sourceId: target.id } });
                            await tx.source.delete({ where: { id: sourceToDelete.id } });
                        });
                    } else {
                        await prisma.source.delete({ where: { id: sourceToDelete.id } });
                    }
                }
                return res.json({ success: true });
            }

            if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

            const data = {
                title,
                shortTitle: shortTitle || null,
                author: author || null,
                publication: publication || null,
                sourceType: sourceType || null,
                category: category || null,
                repositoryId: repositoryId || null
            };

            let resultSource;
            if (id) {
                const existing = await prisma.source.findFirst({ where: { id, treeId: tree.id } });
                if (!existing) return res.status(404).json({ success: false, message: 'Source not found' });
                resultSource = await prisma.source.update({ where: { id }, data });
            } else {
                resultSource = await prisma.source.create({
                    data: { ...data, treeId: tree.id }
                });
            }

            if (notes && Array.isArray(notes)) {
                await prisma.noteLink.deleteMany({ where: { sourceId: resultSource.id } });
                await NotesService.processSharedNotes(prisma, tree.id, notes, { sourceId: resultSource.id }, currentUserId);
            }

            res.json({ success: true });
        } catch (error: any) {
            console.error('Source save error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
