import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { MediaService } from '../services/media.service';
import { STORAGE_ROOT, MEDIA_ROOT, USERS_DIR, TEMP_DIR, upload } from '../index';

export const mediaRoutes = (prisma: PrismaClient) => {
    const router = Router();

    router.get('/', async (req, res) => {
        try {
            const { treeId, type, search } = req.query;
            if (!treeId) return res.status(400).json({ success: false, message: 'treeId required' });

            const where: any = { treeId: treeId as string };

            if (type) {
                if (type === 'FOTOS') {
                    where.OR = [
                        { mediaType: 'PHOTO' },
                        { AND: [{ mediaType: null }, { mimeType: { startsWith: 'image/' } }] }
                    ];
                } else if (type === 'DOKUMENTE') {
                    where.OR = [
                        { mediaType: { in: ['DOCUMENT', 'RECORD'] } },
                        { AND: [{ mediaType: null }, { mimeType: { in: ['application/pdf', 'text/plain'] } }] }
                    ];
                }
            }

            // --- GLOBAL STATS (for the whole tree, ignoring the current filter/search) ---
            const allMediaForStats = await prisma.media.findMany({
                where: { treeId: treeId as string },
                select: { mediaType: true, mimeType: true, links: { select: { id: true } } }
            });
            const stats = {
                total: allMediaForStats.length,
                fotos: allMediaForStats.filter(m => m.mediaType === 'PHOTO' || (!m.mediaType && m.mimeType?.startsWith('image/'))).length,
                docs: allMediaForStats.filter(m => ['DOCUMENT', 'RECORD'].includes(m.mediaType as string) || (!m.mediaType && ['application/pdf', 'text/plain'].includes(m.mimeType as string))).length,
                unlinked: allMediaForStats.filter(m => !m.links || m.links.length === 0).length
            };

            if (search) {
                const searchOr = [
                    { title: { contains: search as string, mode: 'insensitive' } },
                    { path: { contains: search as string, mode: 'insensitive' } },
                    { remoteUrl: { contains: search as string, mode: 'insensitive' } }
                ];
                if (where.OR) {
                    where.AND = [{ OR: where.OR }, { OR: searchOr }];
                    delete where.OR;
                } else {
                    where.OR = searchOr;
                }
            }

            const media = await prisma.media.findMany({
                where,
                include: {
                    links: {
                        include: {
                            person: { include: { names: { where: { isPrimary: true } } } },
                            family: { include: { mediaLinks: { include: { media: true } } } }
                        }
                    },
                    citations: true,
                    identifiers: true,
                    noteLinks: { include: { note: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            // --- Helper for filename extraction ---
            const getFileName = (m: any) => {
                if (m.path) return m.path;
                if (m.remoteUrl) {
                    if (m.remoteUrl.startsWith('http')) return null;
                    // If it's an absolute path, we take the basename for server lookup
                    return path.basename(m.remoteUrl);
                }
                return null;
            };

            // --- Sync/Pruning Logic ---
            const validMedia = [];
            const orphanedIds: string[] = [];

            for (const item of media) {
                let fileFound = true;
                const fname = getFileName(item);

                if (fname && fname !== 'Unbenannt') {
                    // Determine the correct base directory: 
                    // files starting with 'users/' are relative to STORAGE_ROOT
                    // others (orphans/legacy) are relative to MEDIA_ROOT
                    const baseDir = (item.path && item.path.startsWith('users/')) ? STORAGE_ROOT : MEDIA_ROOT;
                    const fullPath = path.join(baseDir, fname);
                    // If the file does NOT exist in the uploads directory, it's a "ghost"
                    // (Unless it's a remote URL, which getFileName returns null for)
                    if (!fs.existsSync(fullPath)) {
                        fileFound = false;
                    }
                } else if (!item.remoteUrl || item.remoteUrl === 'Unbenannt') {
                    // No filename and no remote URL
                    fileFound = false;
                } else if (!item.remoteUrl.startsWith('http')) {
                    // It's a non-web remoteUrl that didn't yield a filename
                    fileFound = false;
                }

                if (fileFound) {
                    validMedia.push(item);
                } else {
                    console.log(`[server]: Identified ghost media entry: ${item.id} (Filename: ${fname}, Remote: ${item.remoteUrl})`);
                    orphanedIds.push(item.id);
                }
            }

            // We only delete if they are both missing AND have no links AND no custom GEDCOM ID
            // (Pruning should be very conservative for imported data)
            const deadIds = media
                .filter(m => orphanedIds.includes(m.id) && (!m.links || m.links.length === 0) && !m.gedcomId)
                .map(m => m.id);

            if (deadIds.length > 0) {
                console.log(`[server]: Pruning ${deadIds.length} dead media entries (missing file, unlinked, no GEDCOM ID)`);
                await prisma.media.deleteMany({
                    where: { id: { in: deadIds } }
                });
            }

            // The remaining orphaned ones (missing but linked) are kept but flagged
            // NEW: We only keep them if they are NOT imported (gedcomId === null)
            // because imported ghosts (77 images!) are annoying the user.
            const finalMedia = validMedia.concat(
                media
                    .filter(m => orphanedIds.includes(m.id) && !deadIds.includes(m.id))
                    .filter(m => !m.gedcomId) // Hide imported ghosts
                    .map(m => ({ ...m, fileMissing: true }))
            );

            let orphanFiles: any[] = [];
            if (type === 'UNLINKED') {
                const knownFileNames = new Set(
                    validMedia
                        .map((m: any) => m.path)
                        .filter((f: any) => typeof f === 'string' && f.length > 0)
                );

                const filesOnDisk = fs.readdirSync(MEDIA_ROOT).filter((f) => {
                    const full = path.join(MEDIA_ROOT, f);
                    return fs.statSync(full).isFile();
                });

                orphanFiles = filesOnDisk
                    .filter((f) => !knownFileNames.has(f))
                    .map((f) => {
                        const full = path.join(MEDIA_ROOT, f);
                        const ext = path.extname(f).toLowerCase();
                        const stats = fs.statSync(full);
                        const mimeType =
                            ext === '.pdf' ? 'application/pdf'
                                : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                                    : ext === '.png' ? 'image/png'
                                        : ext === '.webp' ? 'image/webp'
                                            : ext === '.gif' ? 'image/gif'
                                                : 'application/octet-stream';
                        const mediaType = mimeType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT';

                        return {
                            path: f,
                            remoteUrl: `/uploads/${f}`,
                            mimeType,
                            mediaType,
                            filesize: Math.min(Number.MAX_SAFE_INTEGER, stats.size),
                            links: [],
                            orphanFile: true,
                            createdAt: stats.birthtime ?? stats.mtime
                        };
                    });
            }
            res.json({ success: true, media: [...finalMedia, ...orphanFiles], stats });
        } catch (error: any) {
            console.error('Fetch media error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/adopt-orphan', async (req, res) => {
        try {
            const { treeId, path: filePath, title, mediaType } = req.body;
            if (!treeId || !filePath) {
                return res.status(400).json({ success: false, message: 'treeId and path required' });
            }
            if (filePath.includes('..') || path.isAbsolute(filePath)) {
                return res.status(400).json({ success: false, message: 'Invalid filePath' });
            }

            const fullPath = path.join(MEDIA_ROOT, filePath);
            if (!fs.existsSync(fullPath)) {
                return res.status(404).json({ success: false, message: 'File not found on disk' });
            }

            const existing = await prisma.media.findFirst({
                where: { treeId, path: filePath }
            });
            if (existing) return res.json({ success: true, media: existing, duplicate: true });

            const ext = path.extname(filePath).toLowerCase();
            const mimeType =
                ext === '.pdf' ? 'application/pdf'
                    : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                        : ext === '.png' ? 'image/png'
                            : ext === '.webp' ? 'image/webp'
                                : ext === '.gif' ? 'image/gif'
                                    : 'application/octet-stream';
            const stats = fs.statSync(fullPath);

            const media = await prisma.media.create({
                data: {
                    treeId,
                    title: title || filePath,
                    mediaType: mediaType || (mimeType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT'),
                    path: filePath,
                    remoteUrl: `/uploads/${filePath}`,
                    mimeType,
                    filesize: Math.min(Number.MAX_SAFE_INTEGER, stats.size)
                }
            });

            res.json({ success: true, media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.delete('/orphan-file', async (req, res) => {
        try {
            const { path: filePath } = req.body;
            console.log('[server]: DELETE /api/media/orphan-file request with path:', filePath);
            
            if (!filePath || typeof filePath !== 'string') {
                return res.status(400).json({ success: false, message: 'path required' });
            }
            
            if (filePath.includes('..') || path.isAbsolute(filePath)) {
                return res.status(400).json({ success: false, message: 'Invalid filePath (security)' });
            }

            const fullPath = path.join(MEDIA_ROOT, filePath);
            if (!fs.existsSync(fullPath)) {
                console.warn('[server]: File not found for orphan deletion:', fullPath);
                return res.status(404).json({ success: false, message: 'File not found on disk' });
            }

            fs.unlinkSync(fullPath);
            console.log('[server]: Successfully deleted orphan file:', filePath);
            res.json({ success: true });
        } catch (error: any) {
            console.error('[server]: Orphan file deletion error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/upload', upload.single('file'), async (req, res) => {
        let sessionDir = '';
        try {
            const file = req.file;
            const { treeId, title, mediaType, userId } = req.body;
            console.log(`[server]: POST /api/media/upload - treeId: ${treeId}, userId: ${userId}, title: ${title}`);

            if (!file || !treeId || !userId) {
                return res.status(400).json({ success: false, message: 'File, treeId and userId required' });
            }

            // Check if tree and user actually exist to avoid P2003
            const tree = await prisma.tree.findUnique({ where: { id: treeId } });
            if (!tree) {
                return res.status(400).json({ success: false, message: `tree_not_found: ${treeId}` });
            }

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'user_not_found', 
                    detail: `User ID ${userId} does not exist. Your session might be stale. Please log out and log in again.` 
                });
            }

            const sessionId = crypto.randomUUID();
            sessionDir = path.join(TEMP_DIR, sessionId);
            fs.mkdirSync(sessionDir, { recursive: true });

            const formattedUserId = MediaService.formatUserId(userId);

            const userPath = path.join(USERS_DIR, formattedUserId);
            const originalsDir = path.join(userPath, 'originals', 'v1');
            const thumbsDir = path.join(userPath, 'thumbs');
            const mediumDir = path.join(userPath, 'medium');
            [originalsDir, thumbsDir, mediumDir].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

            const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
            const ext = path.extname(file.originalname).toLowerCase();
            if (!allowedExts.includes(ext)) {
                throw new Error('invalid_mime');
            }

            let width = 0, height = 0;
            const isImage = file.mimetype.startsWith('image/');
            if (isImage) {
                const dims = await MediaService.validateImage(file);
                width = dims.width;
                height = dims.height;
            }

            const uuid = crypto.randomUUID().replace(/-/g, '');
            const filename = `${uuid}${ext}`;
            const relativePath = path.join('users', formattedUserId, 'originals', 'v1', filename);
            const targetPath = path.join(STORAGE_ROOT, relativePath);

            if (isImage) {
                await MediaService.stripExifAndSave(file.path, targetPath);
            } else {
                fs.copyFileSync(file.path, targetPath);
            }

            const media = await prisma.media.create({
                data: {
                    treeId,
                    userId,
                    title: title || file.originalname,
                    mediaType: mediaType || (isImage ? 'PHOTO' : 'DOCUMENT'),
                    path: relativePath,
                    mimeType: file.mimetype,
                    filesize: file.size,
                    dimensions: width && height ? `${width}x${height}` : null,
                    fileFormat: ext.replace('.', ''),
                    version: 1,
                    isCurrent: true
                }
            });

            if (isImage || ext === '.pdf') {
                await MediaService.generateVariants(media.id, prisma, STORAGE_ROOT);
            }

            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true });

            res.json({ success: true, media });
        } catch (error: any) {
            console.error('Upload error:', error);
            if (sessionDir && fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true });
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.get('/file/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { variant } = req.query;

            const media = await prisma.media.findUnique({
                where: { id },
                include: { variants: true }
            });

            if (media) {
                let filePath = media.path;
                let mimeType = media.mimeType;

                if (variant) {
                    const v = media.variants.find(v => v.variant === variant);
                    if (v && v.path) {
                        filePath = v.path;
                        mimeType = v.mimeType;
                    }
                }

                if (!filePath) return res.status(404).send('File not found');
                const fullPath = path.join(STORAGE_ROOT, filePath);
                if (!fs.existsSync(fullPath)) return res.status(404).send('File missing on disk');

                res.setHeader('Content-Type', mimeType || 'application/octet-stream');
                return fs.createReadStream(fullPath).pipe(res);
            }

            if (id.includes('..') || path.isAbsolute(id)) {
                return res.status(400).send('Invalid file path');
            }

            const orphanPath = path.join(MEDIA_ROOT, id);
            if (fs.existsSync(orphanPath)) {
                const ext = path.extname(id).toLowerCase();
                const mimeType = ext === '.pdf' ? 'application/pdf'
                            : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                            : ext === '.png' ? 'image/png'
                            : ext === '.webp' ? 'image/webp'
                            : 'application/octet-stream';
                
                res.setHeader('Content-Type', mimeType);
                return fs.createReadStream(orphanPath).pipe(res);
            }

            res.status(404).send('Not found');
        } catch (e) {
            console.error('[server]: File serving error:', e);
            res.status(500).send('Server error');
        }
    });

    router.patch('/:id/crop', async (req, res) => {
        try {
            const { x, y, width, height } = req.body;
            const media = await prisma.media.update({
                where: { id: req.params.id },
                data: {
                    cropX: x,
                    cropY: y,
                    cropWidth: width,
                    cropHeight: height
                }
            });

            console.log(`[server]: Cropping media ${req.params.id} to ${x},${y} ${width}x${height}`);
            await MediaService.generateVariants(media.id, prisma, STORAGE_ROOT);
            res.json({ success: true, media });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.delete('/:id/crop', async (req, res) => {
        try {
            const media = await prisma.media.update({
                where: { id: req.params.id },
                data: {
                    cropX: null,
                    cropY: null,
                    cropWidth: null,
                    cropHeight: null
                }
            });

            await MediaService.generateVariants(media.id, prisma, STORAGE_ROOT);
            res.json({ success: true, media });
        } catch (error: any) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.get('/:id/usage', async (req, res) => {
        try {
            const { id } = req.params;
            const media = await prisma.media.findUnique({
                where: { id },
                include: {
                    links: {
                        include: {
                            person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                            family: true,
                            source: true,
                            event: true,
                            fact: true
                        }
                    },
                    citations: {
                        include: {
                            person: { include: { names: { where: { isPrimary: true }, take: 1 } } },
                            family: true,
                            event: true,
                            fact: true
                        }
                    }
                }
            });

            if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

            const personLabel = (p: any) =>
                p ? `${p.names?.[0]?.given || ''} ${p.names?.[0]?.surname || ''}`.trim() || p.gedcomId || p.id : null;

            const results = [];

            // Add direct links
            for (const l of media.links) {
                if (l.person) {
                    results.push({
                        context: 'Person',
                        contextLabel: personLabel(l.person),
                        entityId: l.person.id,
                        entityType: 'person'
                    });
                } else if (l.family) {
                    results.push({
                        context: 'Familie',
                        contextLabel: l.family.gedcomId || l.family.id,
                        entityId: l.family.id,
                        entityType: 'family'
                    });
                } else if (l.source) {
                    results.push({
                        context: 'Quelle',
                        contextLabel: l.source.title,
                        entityId: l.source.id,
                        entityType: 'source'
                    });
                }
            }

            // Add citation usages
            for (const c of media.citations) {
                let context = 'Beleg';
                let contextLabel = 'Unbekannt';
                let entityId = null;
                let entityType = null;

                if (c.person) {
                    context = 'Beleg (Person)';
                    contextLabel = personLabel(c.person);
                    entityId = c.person.id;
                    entityType = 'person';
                } else if (c.family) {
                    context = 'Beleg (Familie)';
                    contextLabel = c.family.gedcomId || c.family.id;
                    entityId = c.family.id;
                    entityType = 'family';
                } else if (c.event) {
                    context = `Beleg (Ereignis: ${c.event.type})`;
                    contextLabel = personLabel(c.person) || (c.family as any)?.gedcomId || 'Unbekannt';
                    entityId = c.personId || c.familyId;
                    entityType = c.personId ? 'person' : (c.familyId ? 'family' : null);
                } else if (c.fact) {
                    context = `Beleg (Fakt: ${c.fact.type})`;
                    contextLabel = personLabel(c.person) || (c.family as any)?.gedcomId || 'Unbekannt';
                    entityId = c.personId || c.familyId;
                    entityType = c.personId ? 'person' : (c.familyId ? 'family' : null);
                }

                results.push({
                    context,
                    contextLabel,
                    entityId,
                    entityType,
                    page: c.page,
                    dateText: c.dateText
                });
            }

            res.json({ success: true, usage: results });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/:id', async (req, res) => {
        try {
            const media = await prisma.media.findUnique({
                where: { id: req.params.id },
                include: {
                    links: true,
                    citations: true,
                    identifiers: true,
                    noteLinks: { include: { note: true } }
                }
            });
            if (!media) return res.status(404).json({ success: false, message: 'Media not found' });
            res.json({ success: true, media });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { title, mediaType, notes, identifiers, citations } = req.body;
            const mediaId = req.params.id;

            const result = await prisma.$transaction(async (tx) => {
                const currentMedia = await tx.media.findUnique({
                    where: { id: mediaId },
                    select: { treeId: true }
                });
                if (!currentMedia) throw new Error('Media not found');
                const treeId = currentMedia.treeId;

                const updatedMedia = await tx.media.update({
                    where: { id: mediaId },
                    data: { title, mediaType }
                });

                if (identifiers !== undefined) {
                    await tx.identifier.deleteMany({ where: { mediaId } });
                    if (Array.isArray(identifiers) && identifiers.length > 0) {
                        for (const iden of identifiers) {
                            if (!iden.value) continue;
                            await tx.identifier.create({
                                data: {
                                    treeId,
                                    mediaId,
                                    entityId: mediaId,
                                    entityType: 'MEDIA',
                                    type: iden.type || null,
                                    value: iden.value
                                }
                            });
                        }
                    }
                }

                if (notes !== undefined) {
                    await tx.noteLink.deleteMany({ where: { mediaId } });
                    if (Array.isArray(notes)) {
                        for (const noteData of notes) {
                            const isString = typeof noteData === 'string';
                            const text = isString ? noteData.trim() : (noteData.text || '').trim();
                            if (!text) continue;

                            const sharedNote = await tx.sharedNote.create({
                                data: {
                                    treeId,
                                    text,
                                    noteType: isString ? 'OTHER' : (noteData.noteType || 'OTHER'),
                                    privacyLevel: (!isString && noteData.isPrivate) ? 'PRIVATE' : 'PUBLIC',
                                    researchStatus: 'OPEN'
                                }
                            });
                            await tx.noteLink.create({
                                data: {
                                    treeId,
                                    mediaId,
                                    noteId: sharedNote.id
                                }
                            });
                        }
                    }
                }

                if (citations !== undefined) {
                    await tx.citation.deleteMany({ where: { mediaId } });
                    if (Array.isArray(citations)) {
                        for (const cit of citations) {
                            if (!cit.sourceId) continue;
                            await tx.citation.create({
                                data: {
                                    treeId,
                                    mediaId,
                                    sourceId: cit.sourceId,
                                    page: cit.page || null
                                }
                            });
                        }
                    }
                }

                return updatedMedia;
            });

            res.json({ success: true, media: result });
        } catch (error: any) {
            console.error('Update media error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/:id/link', async (req, res) => {
        try {
            const { treeId, personId, familyId, sourceId, isPrimary } = req.body;
            const mediaId = req.params.id;
            if (!treeId) return res.status(400).json({ success: false, message: 'treeId required' });

            let resolvedPersonId: string | null = null;
            let resolvedFamilyId: string | null = null;
            let resolvedSourceId: string | null = null;

            if (personId) {
                const byId = await prisma.person.findUnique({ where: { id: personId } });
                if (byId) {
                    resolvedPersonId = byId.id;
                } else {
                    const byGedcom = await prisma.person.findFirst({
                        where: { treeId, gedcomId: personId }
                    });
                    if (!byGedcom) {
                        return res.status(400).json({ success: false, message: `Person not found for id ${personId}` });
                    }
                    resolvedPersonId = byGedcom.id;
                }
            }

            if (familyId) {
                const byId = await prisma.family.findUnique({ where: { id: familyId } });
                if (byId) {
                    resolvedFamilyId = byId.id;
                } else {
                    const byGedcom = await prisma.family.findFirst({
                        where: { treeId, gedcomId: familyId }
                    });
                    if (!byGedcom) {
                        return res.status(400).json({ success: false, message: `Family not found for id ${familyId}` });
                    }
                    resolvedFamilyId = byGedcom.id;
                }
            }

            if (sourceId) {
                const byId = await prisma.source.findUnique({ where: { id: sourceId } });
                if (byId) {
                    resolvedSourceId = byId.id;
                } else {
                    const byGedcom = await prisma.source.findFirst({
                        where: { treeId, gedcomId: sourceId }
                    });
                    if (!byGedcom) {
                        return res.status(400).json({ success: false, message: `Source not found for id ${sourceId}` });
                    }
                    resolvedSourceId = byGedcom.id;
                }
            }

            if (!resolvedPersonId && !resolvedFamilyId && !resolvedSourceId) {
                return res.status(400).json({ success: false, message: 'No valid link target provided' });
            }

            const existingLink = await prisma.mediaLink.findFirst({
                where: {
                    treeId,
                    mediaId,
                    personId: resolvedPersonId,
                    familyId: resolvedFamilyId,
                    sourceId: resolvedSourceId
                }
            });
            if (existingLink) {
                return res.json({ success: true, duplicate: true, link: existingLink });
            }

            const link = await prisma.mediaLink.create({
                data: {
                    treeId,
                    mediaId,
                    personId: resolvedPersonId,
                    familyId: resolvedFamilyId,
                    sourceId: resolvedSourceId,
                    isPrimary: isPrimary || false
                }
            });

            res.json({ success: true, link });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.delete('/link/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const existing = await prisma.mediaLink.findUnique({ where: { id } });
            if (!existing) return res.status(404).json({ success: false, message: 'Link not found' });

            await prisma.mediaLink.delete({ where: { id } });
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const media = await prisma.media.findUnique({ where: { id: req.params.id } });
            if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

            const fname = media.path;
            if (fname) {
                const baseDir = (fname.startsWith('users/') || fname.includes('/originals/')) ? STORAGE_ROOT : MEDIA_ROOT;
                const fullPath = path.join(baseDir, fname);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            }

            await prisma.media.delete({ where: { id: req.params.id } });

            await prisma.changeLog.create({
                data: {
                    treeId: media.treeId,
                    action: 'DELETE',
                    entityType: 'MEDIA',
                    entityId: media.id,
                    before: media as any,
                    summary: `Medium ${media.title} gelöscht`
                }
            });

            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
