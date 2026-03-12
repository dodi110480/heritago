import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PersonService } from '../services/person.service';

export const personRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    const personService = new PersonService(prisma);

    router.get('/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const person = await prisma.person.findUnique({
                where: { id, treeId: tree.id },
                include: {
                    names: true,
                    events: { include: { place: true } },
                    facts: { include: { place: true } },
                    mediaLinks: { include: { media: true } },
                    citations: { include: { source: true } }
                }
            });
            if (!person) return res.status(404).json({ success: false, message: 'Person not found', code: 'PERSON_NOT_FOUND' });
            res.json({ success: true, data: PersonService.formatPersonForClient(person) });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_FETCH_FAILED' });
        }
    });

    router.get('/:id/children', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const exists = await prisma.person.findUnique({ where: { id, treeId: tree.id } });
            if (!exists) return res.status(404).json({ success: false, message: 'Person not found', code: 'PERSON_NOT_FOUND' });
            const children = await personService.getChildren(id);
            res.json({ success: true, data: children });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_CHILDREN_FAILED' });
        }
    });

    router.get('/:id/parents', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const exists = await prisma.person.findUnique({ where: { id, treeId: tree.id } });
            if (!exists) return res.status(404).json({ success: false, message: 'Person not found', code: 'PERSON_NOT_FOUND' });
            const parents = await personService.getParents(id);
            res.json({ success: true, data: parents });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_PARENTS_FAILED' });
        }
    });

    router.get('/:id/spouses', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const exists = await prisma.person.findUnique({ where: { id, treeId: tree.id } });
            if (!exists) return res.status(404).json({ success: false, message: 'Person not found', code: 'PERSON_NOT_FOUND' });
            const spouses = await personService.getSpouses(id);
            res.json({ success: true, data: spouses });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_SPOUSES_FAILED' });
        }
    });

    router.post('/', async (req: any, res) => {
        try {
            const tree = req.tree;
            const { mode, id } = req.body;

            if (mode === 'delete' && id) {
                await personService.deletePerson(id, tree.id);
                return res.json({ success: true, data: null });
            }

            // For CREATE / UPDATE, we still want to log.
            // We can either fetch 'before' here OR move it all to service.
            // Let's stick to the current pattern but cleaner.
            
            const userId = req.user?.id;
            
            // Optional: fetch beforeState if we want extremely detailed logs
            let beforeState = null;
            if (id) {
                beforeState = await prisma.person.findUnique({
                    where: { treeId_gedcomId: { treeId: tree.id, gedcomId: id } },
                    include: { names: true, events: true, facts: true }
                });
            }

            const record = await personService.savePerson(tree.id, { ...req.body, beforeState }, userId);

            res.json({ success: true, data: record });
        } catch (error: any) {
            console.error('Save person error:', error);
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_SAVE_FAILED' });
        }
    });

    router.delete('/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            await personService.deletePerson(id, tree.id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            console.error('Delete person error:', error.message);
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_DELETE_FAILED' });
        }
    });

    return router;
};
