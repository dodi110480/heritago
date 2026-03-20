// server/src/repositories/place.repository.ts
import { PrismaClient } from '@prisma/client';
import { includeStandardRelations } from '../shared/relations.utils';

export class PlaceRepository {
    constructor(private prisma: PrismaClient) {}

    async findById(id: string, treeId: string) {
        return this.prisma.place.findFirst({
            where: { id, treeId },
            include: {
                parent: true,
                children: true,
                translations: true,
                identifiers: true,
                noteLinks: { include: { note: true } },
                _count: {
                    select: {
                        events: true,
                        facts: true,
                        associations: true,
                        children: true
                    }
                }
            }
        });
    }

    async findAll(treeId: string) {
        return this.prisma.place.findMany({
            where: { treeId },
            include: {
                _count: {
                    select: {
                        events: true,
                        facts: true,
                        associations: true,
                        children: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    async search(query: string, treeId: string) {
        return this.prisma.place.findMany({
            where: {
                treeId,
                name: { contains: query, mode: 'insensitive' }
            },
            take: 10
        });
    }

    async savePlace(data: any) {
        const { id, treeId, ...rest } = data;
        return this.prisma.place.upsert({
            where: { id: id || '', treeId },
            create: { ...rest, treeId },
            update: rest
        });
    }

    async deletePlace(id: string, treeId: string) {
        return this.prisma.place.delete({
            where: { id, treeId }
        });
    }
}
