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

        const query = (q as string).trim();
        const parts = query.split(/\s+/).filter(p => p.length > 0);

        const [people, places, sources] = await Promise.all([
            prisma.person.findMany({
                where: {
                    treeId: treeId,
                    AND: parts.map(part => ({
                        names: {
                            some: {
                                OR: [
                                    { given: { contains: part, mode: 'insensitive' } },
                                    { surname: { contains: part, mode: 'insensitive' } },
                                    { full: { contains: part, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }))
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
