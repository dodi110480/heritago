// server/src/repositories/media.repository.ts
import { PrismaClient } from '@prisma/client';

/**
 * Include for a fully populated media row.
 *
 * `includeStandardRelations()` cannot be used here: the `Media` model names its
 * link relation `links` (not `mediaLinks`) and additionally owns `identifiers`
 * and `variants`. Using the generic helper made every findById/findAll request
 * fail with "Unknown field `mediaLinks`", and a missing `identifiers` include
 * silently dropped external ids on the next save.
 */
const includeMediaRelations = () => ({
    noteLinks: {
        include: {
            note: {
                include: {
                    createdBy: true
                }
            }
        }
    },
    citations: {
        include: {
            source: true,
            citationTexts: true
        }
    },
    links: {
        include: {
            person: { include: { names: { where: { isPrimary: true } } } },
            family: { include: { mediaLinks: { include: { media: true } } } }
        }
    },
    identifiers: true,
    variants: true
});

export class MediaRepository {
    constructor(private prisma: PrismaClient) {}

    /**
     * Prisma client accessor for services that need to orchestrate multi-table
     * transactions (see MediaWriteService). Read/write helpers stay here.
     */
    get client(): PrismaClient {
        return this.prisma;
    }

    async findById(id: string, treeId: string) {
        return this.prisma.media.findFirst({
            where: {
                treeId,
                OR: [
                    { id },
                    { gedcomId: id }
                ]
            },
            include: includeMediaRelations()
        });
    }

    async deleteMedia(id: string, treeId: string) {
        return this.prisma.media.delete({
            where: { id, treeId }
        });
    }

    async createMediaLink(data: any) {
        return this.prisma.mediaLink.create({ data });
    }

    async findAll(treeId: string) {
        return this.prisma.media.findMany({
            where: { treeId },
            include: includeMediaRelations(),
            orderBy: { createdAt: 'desc' }
        });
    }

    async search(query: string, treeId: string) {
        return this.prisma.media.findMany({
            where: {
                treeId,
                title: { contains: query, mode: 'insensitive' }
            },
            take: 20
        });
    }
}
