// server/src/repositories/source.repository.ts
import { PrismaClient } from '@prisma/client';
import { includeStandardRelations } from '../shared/relations.utils';

export class SourceRepository {
    constructor(private prisma: PrismaClient) {}

    async findById(id: string, treeId: string) {
        return this.prisma.source.findFirst({
            where: {
                treeId,
                OR: [
                    { id },
                    { gedcomId: id }
                ]
            },
            include: {
                ...includeStandardRelations(),
                repository: true
            }
        });
    }

    async saveSource(data: any) {
        const { id, treeId, ...rest } = data;
        return this.prisma.source.upsert({
            where: { id: id || '', treeId },
            create: { ...rest, treeId },
            update: rest
        });
    }

    async deleteSource(id: string, treeId: string) {
        return this.prisma.source.delete({
            where: { id, treeId }
        });
    }
}
