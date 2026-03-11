import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PersonService } from '../services/person.service';

export const personRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });

    router.post('/', async (req, res) => {
        const { tree: treeName } = req.params as { tree: string };
        const { mode, id } = req.body;


        const tree = await prisma.tree.findUnique({ where: { name: treeName } });
        if (!tree) return res.status(404).json({ success: false });

        if (mode === 'delete' && id) {
            const personToDelete = await prisma.person.findUnique({
                where: { treeId_gedcomId: { treeId: tree.id, gedcomId: id } }
            });

            if (personToDelete) {
                await prisma.person.delete({ where: { id: personToDelete.id } });
                await prisma.changeLog.create({
                    data: {
                        treeId: tree.id,
                        action: 'DELETE',
                        entityType: 'PERSON',
                        entityId: personToDelete.id,
                        before: personToDelete as any,
                        summary: `Person ${id} gelöscht`
                    }
                });
            }
            return res.json({ success: true });
        }

        // Für CREATE / UPDATE den alten Stand holen
        let beforeState = null;
        let action: 'CREATE' | 'UPDATE' = 'CREATE';
        if (id) {
            const existing = await prisma.person.findUnique({
                where: { treeId_gedcomId: { treeId: tree.id, gedcomId: id } },
                include: { names: true, events: true, facts: true }
            });
            if (existing) {
                beforeState = existing;
                action = 'UPDATE';
            }
        }

        const userId = req.body?.userId || (req as any).user?.id;
        const record = await PersonService.savePerson(prisma, tree.id, { ...req.body, currentUserId: userId });

        // Nach dem Speichern den neuen Stand für das Log holen
        const afterState = await prisma.person.findUnique({
            where: { id: record.id },
            include: { 
                names: true, 
                events: { include: { place: true, mediaLinks: { include: { media: true } }, citations: { include: { source: true } }, associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } } } }, 
                facts: { include: { place: true, citations: { include: { source: true } }, associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } } } } 
            }
        });

        await prisma.changeLog.create({
            data: {
                treeId: tree.id,
                action: action,
                entityType: 'PERSON',
                entityId: record.id,
                before: beforeState as any,
                after: afterState as any,
                summary: `Person ${req.body?.firstName || ''} ${req.body?.lastName || ''} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`.trim()
            }
        });

        res.json({ success: true, person: record });
    });

    router.delete('/:id', async (req, res) => {
        try {
            const { id, tree: treeName } = req.params as { id: string, tree: string };
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });

            const personToDelete = await prisma.person.findUnique({ where: { id } });
            if (personToDelete) {
                await prisma.changeLog.create({
                    data: {
                        treeId: tree?.id || personToDelete.treeId,
                        action: 'DELETE',
                        entityType: 'PERSON',
                        entityId: id,
                        before: personToDelete as any,
                        summary: `Person ${personToDelete.gedcomId} gelöscht`
                    }
                });
            }

            await prisma.person.delete({ where: { id } });
            res.json({ success: true });
        } catch (error: any) {
            console.error('Delete person error:', error.message);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
