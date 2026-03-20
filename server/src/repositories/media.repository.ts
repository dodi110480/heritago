// server/src/repositories/media.repository.ts
import { PrismaClient } from '@prisma/client';
import { includeStandardRelations } from '../shared/relations.utils';

export class MediaRepository {
    constructor(private prisma: PrismaClient) {}

    async findById(id: string, treeId: string) {
        return this.prisma.media.findFirst({
            where: {
                treeId,
                OR: [
                    { id },
                    { gedcomId: id }
                ]
            },
            include: {
                ...includeStandardRelations(),
                variants: true
            }
        });
    }

    async saveMedia(data: any) {
        const { id, treeId, ...rest } = data;
        return this.prisma.media.upsert({
            where: { id: id || '', treeId },
            create: { ...rest, treeId },
            update: rest
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
            include: {
                ...includeStandardRelations(),
                variants: true
            },
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
