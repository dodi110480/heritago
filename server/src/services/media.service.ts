import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';

export class MediaService {
    static formatUserId(userId: string | number): string {
        if (typeof userId === 'string' && userId.includes('-')) {
            // It's a UUID, just use it safely
            return userId.replace(/[^a-zA-Z0-9-]/g, '');
        }
        const id = typeof userId === 'number' ? userId : parseInt(userId, 10);
        return isNaN(id) ? String(userId).replace(/[^a-zA-Z0-9-]/g, '') : id.toString().padStart(8, '0');
    }

    static async validateImage(file: Express.Multer.File): Promise<{ width: number; height: number }> {
        const metadata = await sharp(file.path).metadata();
        if (!metadata.width || !metadata.height) {
            throw new Error('pixel_limit_exceeded');
        }
        if (metadata.width * metadata.height > 40000000) {
            throw new Error('pixel_limit_exceeded');
        }
        return { width: metadata.width, height: metadata.height };
    }

    static async stripExifAndSave(inputPath: string, outputPath: string): Promise<void> {
        await sharp(inputPath)
            .withMetadata({
                exif: {
                    IFD0: {
                        Software: 'Heritago',
                        ImageUniqueID: path.basename(outputPath, path.extname(outputPath))
                    }
                }
            })
            .toFile(outputPath);
    }

    static async generateVariants(mediaId: string, prisma: PrismaClient, storageRoot: string): Promise<void> {
        const media = await prisma.media.findUnique({ where: { id: mediaId } });
        if (!media || !media.path) return;

        const originalPath = path.join(storageRoot, media.path);
        const userDir = path.dirname(path.dirname(path.dirname(originalPath))); // ../../../
        const thumbsDir = path.join(userDir, 'thumbs');
        const mediumDir = path.join(userDir, 'medium');

        [thumbsDir, mediumDir].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });

        const ext = '.webp';
        const uuid = path.basename(media.path, path.extname(media.path));
        const thumbPath = path.join(thumbsDir, `${uuid}${ext}`);
        const mediumPath = path.join(mediumDir, `${uuid}${ext}`);

        let image = sharp(originalPath);
        if (media.cropX !== null && media.cropY !== null && media.cropWidth !== null && media.cropHeight !== null) {
            image = image.extract({ left: media.cropX, top: media.cropY, width: media.cropWidth, height: media.cropHeight });
        }

        // Generate Thumb
        await image.clone().resize(200, 200, { fit: 'cover' }).webp().toFile(thumbPath);
        // Generate Medium
        await image.clone().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp().toFile(mediumPath);

        // Update Media Variants in DB
        await prisma.mediaVariant.deleteMany({ where: { mediaId } });
        await prisma.mediaVariant.createMany({
            data: [
                { mediaId, variant: 'thumbs', path: path.relative(storageRoot, thumbPath), mimeType: 'image/webp' },
                { mediaId, variant: 'medium', path: path.relative(storageRoot, mediumPath), mimeType: 'image/webp' }
            ]
        });
        console.log(`[server]: Variants generated for media ${mediaId} (Crop: ${media.cropX}, ${media.cropY}, ${media.cropWidth}x${media.cropHeight})`);
    }
}
