// server/src/repositories/tree.repository.ts
import { PrismaClient } from '@prisma/client';

export class TreeRepository {
    constructor(private prisma: PrismaClient) {}

    async findById(id: string) {
        return this.prisma.tree.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        persons: true,
                        families: true,
                        sources: true,
                        media: true
                    }
                }
            }
        });
    }

    async saveTree(data: any) {
        const { id, ...rest } = data;
        return this.prisma.tree.upsert({
            where: { id: id || '' },
            create: rest,
            update: rest
        });
    }

    async deleteTree(id: string) {
        return this.prisma.tree.delete({
            where: { id }
        });
    }
}
