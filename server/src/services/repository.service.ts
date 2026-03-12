import { PrismaClient } from '@prisma/client';

export class RepositoryService {
    constructor(private prisma: PrismaClient) {}

    async getRepositories(treeId: string) {
        const repos = await this.prisma.repository.findMany({
            where: { treeId },
            include: { _count: { select: { sources: true } } },
            orderBy: { name: 'asc' }
        });

        return repos.map(r => ({
            id: r.id,
            name: r.name,
            address: r.address,
            phone: r.phone,
            email: r.email,
            website: r.website,
            sourceCount: r._count.sources
        }));
    }

    async saveRepository(treeId: string, data: any) {
        const { id, name, address, phone, email, website } = data;

        if (!name) throw new Error('Name is required');

        const repoData = {
            name,
            address: address || null,
            phone: phone || null,
            email: email || null,
            website: website || null,
        };

        if (id) {
            const existing = await this.prisma.repository.findFirst({ where: { id, treeId } });
            if (!existing) throw new Error('Repository not found');
            return this.prisma.repository.update({ where: { id }, data: repoData });
        } else {
            return this.prisma.repository.create({ data: { ...repoData, treeId } });
        }
    }

    async deleteRepository(treeId: string, id: string) {
        const repo = await this.prisma.repository.findFirst({ where: { id, treeId } });
        if (!repo) throw new Error('Repository not found');

        return this.prisma.$transaction(async (tx) => {
            await tx.source.updateMany({ where: { repositoryId: id }, data: { repositoryId: null } });
            await tx.repository.delete({ where: { id: repo.id } });
            return true;
        });
    }
}
