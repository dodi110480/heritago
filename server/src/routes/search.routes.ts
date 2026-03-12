import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PersonService } from '../services/person.service';

export const searchRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const personService = new PersonService(prisma);

    router.get('/', async (req, res) => {
        const treeId = (req as any).tree.id;
        const { q } = req.query;
        if (!q) return res.json({ success: true, data: [] });

        const [people, places, sources] = await Promise.all([
            prisma.person.findMany({
                where: {
                    treeId: treeId,
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
                include: { names: true, events: { include: { place: true } } },
                take: 15
            }),
            prisma.place.findMany({
                where: { treeId, name: { contains: q as string, mode: 'insensitive' } },
                take: 10
            }),
            prisma.source.findMany({
                where: { treeId, title: { contains: q as string, mode: 'insensitive' } },
                take: 10
            })
        ]);

        const results = [
            ...people.map(p => ({ ...PersonService.formatPersonForClient(p), type: 'PERSON' })),
            ...places.map(p => ({ ...p, type: 'PLACE' })),
            ...sources.map(s => ({ ...s, type: 'SOURCE' }))
        ];
        res.json({ success: true, data: results });
    });

    return router;
};
