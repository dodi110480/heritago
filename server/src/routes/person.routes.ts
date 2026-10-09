import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { PersonReadService } from '../services/person/person.read.service';
import { PersonWriteService } from '../services/person/person.write.service';
import { PersonRepository } from '../repositories/person.repository';
import { AuditService } from '../services/audit.service';
import { NotesService } from '../services/notes.service';
import { ChangeRequestService } from '../services/change-request.service';

export const personRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });
    
    // Manual DI for factory-style route setup
    const personRepo = new PersonRepository(prisma);
    const auditService = new AuditService(prisma);
    const notesService = new NotesService(prisma);
    const personReadService = new PersonReadService(personRepo);
    const personWriteService = new PersonWriteService(personRepo, auditService, notesService);
    const changeRequestService = new ChangeRequestService(prisma);

    router.get('/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const person = await personReadService.getPerson(id, tree.id);
            if (!person) return res.status(404).json({ success: false, message: 'Person not found', code: 'PERSON_NOT_FOUND' });
            res.json({ success: true, data: person });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_FETCH_FAILED' });
        }
    });

    router.get('/:id/full-profile', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const profile = await personReadService.getFullProfile(id, tree.id);
            if (!profile) return res.status(404).json({ success: false, message: 'Person profile not found' });
            res.json({ success: true, data: profile });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.get('/:id/children', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const exists = await personRepo.findById(id, tree.id);
            if (!exists) return res.status(404).json({ success: false, message: 'Person not found', code: 'PERSON_NOT_FOUND' });
            const children = await personReadService.getChildren(id);
            res.json({ success: true, data: children });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_CHILDREN_FAILED' });
        }
    });

    router.get('/:id/parents', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const parents = await personReadService.getParents(id, tree.id);
            res.json({ success: true, data: parents });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_PARENTS_FAILED' });
        }
    });

    router.get('/:id/spouses', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            const spouses = await personReadService.getSpouses(id);
            res.json({ success: true, data: spouses });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_SPOUSES_FAILED' });
        }
    });

    router.post('/', async (req: any, res) => {
        try {
            const tree = req.tree;

            // Non-owners propose changes instead of applying them directly.
            if (req.permission !== 'OWNER') {
                const operation = req.body.id ? 'UPDATE' : 'CREATE';
                const summary = `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim() || 'Person';
                const cr = await changeRequestService.proposeChange(tree.id, req.user.id, 'PERSON', req.body.id || null, operation, req.body, summary);
                return res.status(202).json({ success: true, data: { pending: true, changeRequestId: cr.id, message: 'Änderung zur Bestätigung vorgeschlagen.' } });
            }

            const { id } = req.body;

            const userId = req.user?.id;
            
            let beforeState = null;
            if (id) {
                beforeState = await personRepo.findById(id, tree.id);
            }

            const record = await personWriteService.updatePerson({ ...req.body, treeId: tree.id, beforeState }, userId);
            const profile = await personReadService.getFullProfile(record.id, tree.id);

            res.json({ success: true, data: profile || record });
        } catch (error: any) {
            console.error('Save person error:', error);
            const status = error?.statusCode || error?.status || 500;
            const code = error?.code || 'PERSON_SAVE_FAILED';
            res.status(status).json({ success: false, message: error.message, code });
        }
    });

    router.delete('/:id', async (req: any, res) => {
        try {
            const { id } = req.params;
            const tree = req.tree;
            await personWriteService.deletePerson(id, tree.id, req.user?.id);
            res.json({ success: true, data: null });
        } catch (error: any) {
            console.error('Delete person error:', error.message);
            res.status(500).json({ success: false, message: error.message, code: 'PERSON_DELETE_FAILED' });
        }
    });

    return router;
};
