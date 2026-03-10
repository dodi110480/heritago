import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GedcomManager } from '../services/gedcom.service';

export const analyzeInvalidFamilyIds = async (prisma: PrismaClient, treeId: string) => {
    const families = await prisma.family.findMany({
        where: { treeId },
        include: {
            familyMembers: {
                include: { person: true }
            }
        }
    });

    const signatureToFamilies = new Map<string, typeof families>();
    for (const family of families) {
        const spouseIds = family.familyMembers
            .filter(fm => fm.role === 'SPOUSE')
            .map(fm => fm.person?.gedcomId || '')
            .filter(Boolean)
            .sort();
        const childIds = family.familyMembers
            .filter(fm => fm.role === 'CHILD')
            .map(fm => fm.person?.gedcomId || '')
            .filter(Boolean)
            .sort();
        const signature = `S:${spouseIds.join('|')}|C:${childIds.join('|')}`;
        if (!signatureToFamilies.has(signature)) signatureToFamilies.set(signature, []);
        signatureToFamilies.get(signature)!.push(family);
    }

    const invalidFamilies = families.filter(f => !GedcomManager.isGedcomXref(f.gedcomId || ''));
    const invalidIds = invalidFamilies.map(f => f.id);
    const duplicateCleanupCandidates: Array<{ canonicalId: string; deleteIds: string[]; signature: string }> = [];

    for (const [signature, grouped] of signatureToFamilies.entries()) {
        if (grouped.length < 2) continue;
        const canonical = grouped.find(f => GedcomManager.isGedcomXref(f.gedcomId || ''));
        if (!canonical) continue;
        const deleteIds = grouped
            .filter(f => f.id !== canonical.id && !GedcomManager.isGedcomXref(f.gedcomId || ''))
            .map(f => f.id);
        if (deleteIds.length > 0) {
            duplicateCleanupCandidates.push({
                canonicalId: canonical.id,
                deleteIds,
                signature
            });
        }
    }

    return { invalidIds, duplicateCleanupCandidates };
};

export const familyRoutes = (prisma: PrismaClient) => {
    const router = Router({ mergeParams: true });

    router.post('/', async (req, res) => {
        const { tree: treeName } = req.params as { tree: string };
        const data = req.body;

        try {
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

            let beforeState = null;
            if (data.id) {
                beforeState = await prisma.family.findUnique({
                    where: { treeId_gedcomId: { treeId: tree.id, gedcomId: data.id } },
                    include: { familyMembers: { include: { person: { include: { names: true } } } }, events: true, noteLinks: { include: { note: true } } }
                });
            }

            const userId = req.body?.userId || (req as any).user?.id;
            const result = await GedcomManager.saveFamily(prisma, tree.id, { ...data, currentUserId: userId }, userId);

            if (result && !('deleted' in result)) {
                const familyAfter = await prisma.family.findUnique({
                    where: { id: result.id },
                    include: { 
                        familyMembers: { include: { person: { include: { names: true } } } }, 
                        events: { include: { place: true, mediaLinks: { include: { media: true } }, noteLinks: { include: { note: { include: { createdBy: { select: { id: true, username: true } } } } } }, citations: { include: { source: true } }, associations: { include: { associated: { include: { names: { where: { isPrimary: true } } } } } } } }, 
                        noteLinks: { include: { note: { include: { createdBy: { select: { id: true, username: true } } } } } } 
                    }
                });

                const action = beforeState ? 'UPDATE' : 'CREATE';
                const husband = familyAfter?.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'M')?.person;
                const wife = familyAfter?.familyMembers.find(m => m.role === 'SPOUSE' && m.person.sex === 'F')?.person;

                const hName = husband ? (husband.names[0]?.surname || husband.gedcomId) : '?';
                const wName = wife ? (wife.names[0]?.surname || wife.gedcomId) : '?';

                await prisma.changeLog.create({
                    data: {
                        treeId: tree.id,
                        action: action,
                        entityType: 'FAMILY',
                        entityId: result.id,
                        before: beforeState as any,
                        after: familyAfter as any,
                        summary: `Familie ${hName} / ${wName} ${action === 'CREATE' ? 'erstellt' : 'aktualisiert'}`
                    }
                });
            } else if (result && 'deleted' in result && beforeState) {
                await prisma.changeLog.create({
                    data: {
                        treeId: tree.id,
                        action: 'DELETE',
                        entityType: 'FAMILY',
                        entityId: (beforeState as any).id,
                        before: beforeState as any,
                        summary: `Familie ${(beforeState as any).gedcomId} gelöscht`
                    }
                });
            }

            res.json({ success: true, family: result });
        } catch (error: any) {
            console.error('Save family error:', error);
            const message = error?.message || 'Failed to save family';
            const isValidationError =
                message.includes('cannot be the same person') ||
                message.includes('cannot be added as child') ||
                message.includes('Referenced person(s) not found') ||
                message.includes('Family ID is required') ||
                message.includes('Family ID must use GEDCOM format');
            res.status(isValidationError ? 400 : 500).json({ success: false, message });
        }
    });

    router.post('/cleanup-invalid-ids', async (req, res) => {
        try {
            const { tree: treeName } = req.params as { tree: string };
            const { dryRun = true } = req.body || {};
            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

            const { invalidIds, duplicateCleanupCandidates } = await analyzeInvalidFamilyIds(prisma, tree.id);
            const deleteIds = Array.from(new Set(duplicateCleanupCandidates.flatMap(c => c.deleteIds)));

            if (!dryRun && deleteIds.length > 0) {
                await prisma.family.deleteMany({
                    where: { treeId: tree.id, id: { in: deleteIds } }
                });
            }

            res.json({
                success: true,
                dryRun: !!dryRun,
                invalidFamilyIds: invalidIds,
                duplicateCleanupCandidates,
                deleteIds,
                deletedCount: dryRun ? 0 : deleteIds.length
            });
        } catch (error: any) {
            console.error('Cleanup invalid family IDs error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    router.post('/delete-invalid-ids', async (req, res) => {
        try {
            const { tree: treeName } = req.params as { tree: string };
            const { ids } = req.body || {};
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ success: false, message: 'ids array is required' });
            }

            const tree = await prisma.tree.findUnique({ where: { name: treeName } });
            if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

            const requestedIds = ids.map((x: any) => String(x || '').trim()).filter(Boolean);
            const existing = await prisma.family.findMany({
                where: { treeId: tree.id, id: { in: requestedIds } },
                select: { id: true, gedcomId: true }
            });

            const deletable = existing
                .filter(f => !GedcomManager.isGedcomXref(f.gedcomId || ''))
                .map(f => f.id);

            let deletedCount = 0;
            if (deletable.length > 0) {
                const del = await prisma.family.deleteMany({
                    where: { treeId: tree.id, id: { in: deletable } }
                });
                deletedCount = del.count;
            }

            const skipped = requestedIds.filter(id => !deletable.includes(id));

            res.json({
                success: true,
                requestedIds,
                deletedIds: deletable,
                deletedCount,
                skippedIds: skipped
            });
        } catch (error: any) {
            console.error('Delete invalid family IDs error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });

    return router;
};
