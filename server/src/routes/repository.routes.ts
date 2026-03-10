import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

export const repositoryRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });

    router.get('/', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const repos = await prisma.repository.findMany({
            where: { treeId: tree.id },
            include: { _count: { select: { sources: true } } },
            orderBy: { name: 'asc' }
        });

        res.json({
            success: true,
            repositories: repos.map(r => ({
                id: r.id,
                name: r.name,
                address: r.address,
                phone: r.phone,
                email: r.email,
                website: r.website,
                sourceCount: r._count.sources
            }))
        });
    });

    router.post('/', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { id, name, address, phone, email, website, mode } = req.body;

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        try {
            if (mode === 'delete' && id) {
                const repo = await prisma.repository.findFirst({ where: { id, treeId: tree.id } });
                if (repo) {
                    await prisma.source.updateMany({ where: { repositoryId: id }, data: { repositoryId: null } });
                    await prisma.repository.delete({ where: { id: repo.id } });
                }
                return res.json({ success: true });
            }

            if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

            const data = {
                name,
                address: address || null,
                phone: phone || null,
                email: email || null,
                website: website || null,
            };

            if (id) {
                const existing = await prisma.repository.findFirst({ where: { id, treeId: tree.id } });
                if (!existing) return res.status(404).json({ success: false, message: 'Repository not found' });
                await prisma.repository.update({ where: { id }, data });
            } else {
                await prisma.repository.create({ data: { ...data, treeId: tree.id } });
            }

            res.json({ success: true });
        } catch (error: any) {
            console.error('Repository save error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
