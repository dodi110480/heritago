import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GedcomManager } from '../services/gedcom.service';

export const searchRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });

    router.get('/', async (req, res) => {
        const treeName = (req.params as any).tree as string;
        const { q } = req.query;
        if (!q) return res.json({ success: true, results: [] });

        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        const people = await prisma.person.findMany({
            where: {
                treeId: tree.id,
                names: {
                    some: {
                        OR: [
                            { given: { contains: q as string, mode: 'insensitive' } },
                            { surname: { contains: q as string, mode: 'insensitive' } },
                            { full: { contains: q as string, mode: 'insensitive' } }
                        ]
                    }
                }
            },
            include: {
                names: true,
                events: { include: { place: true } }
            },
            take: 20
        });

        const results = people.map(p => GedcomManager.formatGedcom(p));
        res.json({ success: true, results });
    });

    return router;
};
