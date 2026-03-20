import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { STORAGE_ROOT, MEDIA_ROOT, TEMP_DIR, USERS_DIR } from '../config';
import { NotesService } from './notes.service';

export class MediaService {
    constructor(private prisma: PrismaClient, private notesService: NotesService) {}

    async getMediaById(treeId: string, id: string) {
        const media = await this.prisma.media.findUnique({
            where: { id, treeId },
            include: {
                links: {
                    include: {
                        person: { include: { names: { where: { isPrimary: true } } } },
                        family: { include: { mediaLinks: { include: { media: true } } } }
                    }
                },
                citations: { include: { source: true } },
                identifiers: true,
                noteLinks: { include: { note: true } },
                variants: true
            }
        });

        if (!media) return null;
        return this.formatMediaForClient(media);
    }

    static formatUserId(userId: string | number): string {
        if (typeof userId === 'string' && userId.includes('-')) {
            return userId.replace(/[^a-zA-Z0-9-]/g, '');
        }
        const id = typeof userId === 'number' ? userId : parseInt(userId, 10);
        return isNaN(id) ? String(userId).replace(/[^a-zA-Z0-9-]/g, '') : id.toString().padStart(8, '0');
    }

    async getMedia(treeId: string, type?: string, search?: string) {
        const where: any = { treeId };

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

        // --- GLOBAL STATS ---
        const allMediaForStats = await this.prisma.media.findMany({
            where: { treeId },
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
                { title: { contains: search, mode: 'insensitive' } },
                { path: { contains: search, mode: 'insensitive' } },
                { remoteUrl: { contains: search, mode: 'insensitive' } }
            ];
            if (where.OR) {
                where.AND = [{ OR: where.OR }, { OR: searchOr }];
                delete where.OR;
            } else {
                where.OR = searchOr;
            }
        }

        const media = await this.prisma.media.findMany({
            where,
            include: {
                links: {
                    include: {
                        person: { include: { names: { where: { isPrimary: true } } } },
                        family: { include: { mediaLinks: { include: { media: true } } } }
                    }
                },
                citations: { include: { source: true } },
                identifiers: true,
                noteLinks: { include: { note: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const getFileName = (m: any) => {
            if (m.path) return m.path;
            if (m.remoteUrl) {
                if (m.remoteUrl.startsWith('http')) return null;
                return path.basename(m.remoteUrl);
            }
            return null;
        };

        const validMedia = [];
        const orphanedIds: string[] = [];

        for (const item of media) {
            let fileFound = true;
            const fname = getFileName(item);

            if (fname && fname !== 'Unbenannt') {
                const baseDir = (item.path && item.path.startsWith('users/')) ? STORAGE_ROOT : MEDIA_ROOT;
                const fullPath = path.join(baseDir, fname);
                if (!fs.existsSync(fullPath)) fileFound = false;
            } else if (!item.remoteUrl || item.remoteUrl === 'Unbenannt') {
                fileFound = false;
            } else if (!item.remoteUrl.startsWith('http')) {
                fileFound = false;
            }

            if (fileFound) {
                validMedia.push(item);
            } else {
                orphanedIds.push(item.id);
            }
        }

        const deadIds = media
            .filter(m => orphanedIds.includes(m.id) && (!m.links || m.links.length === 0) && !m.gedcomId)
            .map(m => m.id);

        if (deadIds.length > 0) {
            await this.prisma.media.deleteMany({ where: { id: { in: deadIds } } });
        }

        const finalMedia = validMedia.concat(
            media
                .filter(m => orphanedIds.includes(m.id) && !deadIds.includes(m.id))
                .filter(m => !m.gedcomId)
                .map(m => ({ ...m, fileMissing: true }))
        );

        let orphanFiles: any[] = [];
        if (type === 'UNLINKED') {
            const knownFileNames = new Set(
                validMedia.map((m: any) => m.path).filter((f: any) => f && f.length > 0)
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
                    const mimeType = ext === '.pdf' ? 'application/pdf'
                        : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                            : ext === '.png' ? 'image/png'
                                : ext === '.webp' ? 'image/webp'
                                    : ext === '.gif' ? 'image/gif'
                                        : 'application/octet-stream';
                    return {
                        path: f,
                        remoteUrl: `/uploads/${f}`,
                        mimeType,
                        mediaType: mimeType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT',
                        filesize: Math.min(Number.MAX_SAFE_INTEGER, stats.size),
                        links: [],
                        orphanFile: true,
                        createdAt: stats.birthtime ?? stats.mtime
                    };
                });
        }

        return { 
            media: [...finalMedia, ...orphanFiles].map(m => this.formatMediaForClient(m)), 
            stats 
        };
    }

    private formatMediaForClient(m: any) {
        return {
            ...m,
            notes: (m.noteLinks || []).map((nl: any) => nl.note).filter(Boolean),
            formattedNotes: MediaService.formatNotesForClient(m.noteLinks || []),
            formattedCitations: MediaService.formatCitationsForClient(m.citations || [])
        };
    }

    private static formatNotesForClient(noteLinks: any[]): any[] {
        if (!noteLinks) return [];
        return noteLinks.map(nl => {
            const n = nl.note;
            if (!n) return null;
            return {
                id: n.id,
                text: n.text,
                noteType: n.noteType,
                isPrivate: n.privacyLevel === 'PRIVATE',
                date: n.createdAt ? n.createdAt.toLocaleDateString('de-DE') : ''
            };
        }).filter(Boolean);
    }

    private static formatCitationsForClient(citations: any[]): any[] {
        if (!citations) return [];
        return citations.map(c => {
            return {
                id: c.id,
                sourceId: c.sourceId,
                title: c.source?.title || 'Unbekannte Quelle',
                whereInSource: c.page || '',
                confidenceLabel: c.confidence === 'CERTAIN' ? 'Sicher' : 
                                 c.confidence === 'VERY_LIKELY' ? 'Sehr wahrscheinlich' :
                                 c.confidence === 'LIKELY' ? 'Wahrscheinlich' : 'Unzuverlässig'
            };
        });
    }

    async getMediaFilePath(id: string, variant?: string): Promise<{ path: string; mimeType: string } | null> {
        const media = await this.prisma.media.findUnique({
            where: { id },
            include: { variants: true }
        });
        if (!media) return null;

        if (variant && media.variants.length > 0) {
            const v = media.variants.find(varnt => varnt.variant === variant);
            if (v && v.path) {
                const fullPath = path.join(STORAGE_ROOT, v.path || '');
                if (fs.existsSync(fullPath)) {
                    return { path: fullPath, mimeType: v.mimeType || 'image/webp' };
                }
            }
        }

        // Default to original
        if (media.path) {
            const baseDir = (media.path.startsWith('users/')) ? STORAGE_ROOT : MEDIA_ROOT;
            const fullPath = path.join(baseDir, media.path);
            if (fs.existsSync(fullPath)) {
                return { path: fullPath, mimeType: media.mimeType || 'application/octet-stream' };
            }
        }

        return null;
    }

    async saveMedia(id: string, data: any, currentUserId?: string) {
        const { title, mediaType, notes, identifiers, citations } = data;
        
        const treeId = await this.prisma.$transaction(async (tx) => {
            const currentMedia = await tx.media.findUnique({
                where: { id },
                select: { treeId: true }
            });
            if (!currentMedia) throw new Error('Media not found');
            const tid = currentMedia.treeId;

            await tx.media.update({
                where: { id },
                data: { title, mediaType }
            });

            if (identifiers !== undefined) {
                await tx.identifier.deleteMany({ where: { mediaId: id } });
                if (Array.isArray(identifiers)) {
                    for (const iden of identifiers) {
                        if (!iden.value) continue;
                        await tx.identifier.create({
                            data: {
                                treeId: tid, mediaId: id, entityId: id, entityType: 'MEDIA',
                                type: iden.type || null, value: iden.value
                            }
                        });
                    }
                }
            }

            if (notes !== undefined) {
                await this.notesService.processSharedNotes(tx, tid, notes, { mediaId: id }, currentUserId);
            }

            await tx.citation.deleteMany({ where: { mediaId: id } });
            if (Array.isArray(citations)) {
                for (const cit of citations) {
                    if (!cit.sourceId) continue;
                    await tx.citation.create({
                        data: { treeId: tid, mediaId: id, sourceId: cit.sourceId, page: cit.page || null }
                    });
                }
            }

            return tid;
        });

        // Return fully formatted object
        return await this.getMediaById(treeId, id);
    }

    async deleteMedia(id: string) {
        const media = await this.prisma.media.findUnique({ where: { id } });
        if (!media) throw new Error('Media not found');

        const fname = media.path;
        if (fname) {
            const baseDir = (fname.startsWith('users/') || fname.includes('/originals/')) ? STORAGE_ROOT : MEDIA_ROOT;
            const fullPath = path.join(baseDir, fname);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        await this.prisma.media.delete({ where: { id } });
        await this.prisma.changeLog.create({
            data: {
                treeId: media.treeId,
                action: 'DELETE', entityType: 'MEDIA', entityId: media.id,
                before: media as any, summary: `Medium ${media.title} gelöscht`
            }
        });
    }

    static async validateImage(file: Express.Multer.File): Promise<{ width: number; height: number }> {
        const metadata = await sharp(file.path).metadata();
        if (!metadata.width || !metadata.height) throw new Error('pixel_limit_exceeded');
        if (metadata.width * metadata.height > 40000000) throw new Error('pixel_limit_exceeded');
        return { width: metadata.width, height: metadata.height };
    }

    static async stripExifAndSave(inputPath: string, outputPath: string): Promise<void> {
        await sharp(inputPath)
            .withMetadata({ exif: { IFD0: { Software: 'Heritago', ImageUniqueID: path.basename(outputPath, path.extname(outputPath)) } } })
            .toFile(outputPath);
    }

    static async generateVariants(mediaId: string, prisma: PrismaClient, storageRoot: string): Promise<void> {
        const media = await prisma.media.findUnique({ where: { id: mediaId } });
        if (!media || !media.path) return;

        const baseDir = media.path.startsWith('users/') ? storageRoot : MEDIA_ROOT;
        const originalPath = path.join(baseDir, media.path);
        const userDir = path.dirname(path.dirname(originalPath)); 
        const thumbsDir = path.join(userDir, 'thumbs');
        const mediumDir = path.join(userDir, 'medium');

        [thumbsDir, mediumDir].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); });

        const uuid = path.basename(media.path, path.extname(media.path));
        let image = sharp(originalPath);
        if (media.cropX !== null && media.cropY !== null && media.cropWidth !== null && media.cropHeight !== null) {
            image = image.extract({ left: media.cropX, top: media.cropY, width: media.cropWidth, height: media.cropHeight });
        }

        const thumbPath = path.join(thumbsDir, `${uuid}.webp`);
        const mediumPath = path.join(mediumDir, `${uuid}.webp`);
        await image.clone().resize(200, 200, { fit: 'cover' }).webp().toFile(thumbPath);
        await image.clone().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp().toFile(mediumPath);

        await prisma.mediaVariant.deleteMany({ where: { mediaId } });
        await prisma.mediaVariant.createMany({
            data: [
                { mediaId, variant: 'thumbs', path: path.relative(storageRoot, thumbPath), mimeType: 'image/webp' },
                { mediaId, variant: 'medium', path: path.relative(storageRoot, mediumPath), mimeType: 'image/webp' }
            ]
        });
    }

    async adoptOrphan(treeId: string, filePath: string, title?: string, mediaType?: string) {
        if (!filePath || filePath.includes('..') || path.isAbsolute(filePath)) {
            throw new Error('Invalid filePath');
        }

        const orphanPath = path.join(MEDIA_ROOT, filePath);
        if (!fs.existsSync(orphanPath)) {
            throw new Error('Orphan file not found');
        }

        const stats = fs.statSync(orphanPath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = ext === '.pdf' ? 'application/pdf'
            : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg'
                : ext === '.png' ? 'image/png'
                    : ext === '.webp' ? 'image/webp'
                        : 'application/octet-stream';

        const media = await this.prisma.media.create({
            data: {
                treeId,
                title: title || path.basename(filePath, ext),
                path: filePath,
                mimeType,
                mediaType: mediaType || (mimeType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT'),
                filesize: Math.min(Number.MAX_SAFE_INTEGER, stats.size)
            }
        });

        if (mimeType.startsWith('image/')) {
            await MediaService.generateVariants(media.id, this.prisma, MEDIA_ROOT);
        }

        return media;
    }

    async uploadMedia(treeId: string, file: Express.Multer.File, data: { userId?: string, title?: string, mediaType?: string }) {
        const { userId, title, mediaType } = data;
        const formattedUserId = MediaService.formatUserId(userId || '0');
        const userDir = path.join(USERS_DIR, formattedUserId, 'originals');
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

        const fileExt = path.extname(file.originalname).toLowerCase() || '.bin';
        const fileUuid = crypto.randomUUID();
        const finalPath = path.join(userDir, `${fileUuid}${fileExt}`);
        const relativePath = path.relative(STORAGE_ROOT, finalPath);

        const isImage = file.mimetype.startsWith('image/');
        if (isImage) {
            await MediaService.validateImage(file);
            await MediaService.stripExifAndSave(file.path, finalPath);
        } else {
            fs.copyFileSync(file.path, finalPath);
        }
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        const media = await this.prisma.media.create({
            data: {
                treeId,
                userId: userId || null,
                title: title || file.originalname,
                path: relativePath,
                mimeType: file.mimetype,
                mediaType: mediaType || (isImage ? 'PHOTO' : 'DOCUMENT'),
                filesize: Math.min(Number.MAX_SAFE_INTEGER, file.size)
            }
        });

        if (isImage) {
            await MediaService.generateVariants(media.id, this.prisma, STORAGE_ROOT);
        }

        return media;
    }

    async updateCrop(treeId: string, mediaId: string, crop: { x: number, y: number, width: number, height: number }) {
        const media = await this.prisma.media.update({
            where: { id: mediaId, treeId },
            data: {
                cropX: Math.round(crop.x),
                cropY: Math.round(crop.y),
                cropWidth: Math.round(crop.width),
                cropHeight: Math.round(crop.height)
            }
        });

        if (media.mimeType?.startsWith('image/')) {
            await MediaService.generateVariants(mediaId, this.prisma, STORAGE_ROOT);
        }

        return media;
    }

    async resetCrop(treeId: string, mediaId: string) {
        const media = await this.prisma.media.update({
            where: { id: mediaId, treeId },
            data: {
                cropX: null,
                cropY: null,
                cropWidth: null,
                cropHeight: null
            }
        });

        if (media.mimeType?.startsWith('image/')) {
            await MediaService.generateVariants(mediaId, this.prisma, STORAGE_ROOT);
        }

        return media;
    }

    async getMediaUsage(treeId: string, mediaId: string) {
        const links = await this.prisma.mediaLink.findMany({
            where: { mediaId, treeId },
            include: {
                person: { include: { names: { where: { isPrimary: true } } } },
                family: {
                    include: {
                        familyMembers: {
                            include: {
                                person: { include: { names: { where: { isPrimary: true } } } }
                            }
                        }
                    }
                },
                source: true
            }
        });

        return links.map(l => {
            let context = 'Medium';
            let contextLabel = 'Unbekannt';
            let entityId = l.id;
            let entityType = 'media';
            let confidence = l.isPrimary ? 'CERTAIN' : undefined;

            if (l.person) {
                context = 'Person';
                contextLabel = l.person.names[0]?.full || 'Unbekannte Person';
                entityId = l.personId!;
                entityType = 'person';
            } else if (l.family) {
                context = 'Familie';
                const h = l.family.familyMembers.find(m => m.role === 'SPOUSE');
                const w = l.family.familyMembers.find(m => m.role === 'SPOUSE' && m !== h);
                const hName = h?.person.names[0]?.full || 'Sohn/Tochter';
                const wName = w?.person.names[0]?.full || 'Unbekannt';
                contextLabel = `${hName} & ${wName}`;
                entityId = l.familyId!;
                entityType = 'family';
            } else if (l.source) {
                context = 'Quelle';
                contextLabel = l.source.title;
                entityId = l.sourceId!;
                entityType = 'source';
            }

            return {
                context,
                contextLabel,
                entityId,
                entityType,
                confidence
            };
        });
    }

    async linkMedia(treeId: string, mediaId: string, data: { personId?: string, familyId?: string, sourceId?: string, isPrimary?: boolean }) {
        return await this.prisma.mediaLink.create({
            data: {
                treeId,
                mediaId,
                personId: data.personId || null,
                familyId: data.familyId || null,
                sourceId: data.sourceId || null,
                isPrimary: !!data.isPrimary
            },
            include: {
                person: { include: { names: { where: { isPrimary: true } } } },
                family: true,
                source: true
            }
        });
    }

    async unlinkMedia(treeId: string, linkId: string) {
        return await this.prisma.mediaLink.delete({
            where: { id: linkId, treeId }
        });
    }

    async deleteOrphanFile(treeId: string, filePath: string) {
        if (!filePath || filePath.includes('..') || path.isAbsolute(filePath)) {
            throw new Error('Invalid filePath');
        }

        const fullPath = path.join(MEDIA_ROOT, filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            return true;
        }
        return false;
    }
}
