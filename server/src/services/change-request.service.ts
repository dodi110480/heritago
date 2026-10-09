import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification.service';
import { PersonWriteService } from './person/person.write.service';
import { PersonRepository } from '../repositories/person.repository';
import { FamilyWriteService } from './family/family.write.service';
import { FamilyRepository } from '../repositories/family.repository';
import { AuditService } from './audit.service';
import { NotesService } from './notes.service';

export class ChangeRequestService {
    private notificationService: NotificationService;

    constructor(private prisma: PrismaClient) {
        this.notificationService = new NotificationService(prisma);
    }

    async proposeChange(treeId: string, userId: string, entityType: string, entityId: string | null, operation: string, payload: any, summary: string) {
        const changeRequest = await this.prisma.changeRequest.create({
            data: { treeId, userId, entityType, entityId, operation, payload, summary }
        });

        const owners = await this.prisma.treePermission.findMany({
            where: { treeId, level: 'OWNER' },
            select: { userId: true }
        });
        const author = await this.prisma.user.findUnique({ where: { id: userId } });

        for (const owner of owners) {
            if (owner.userId === userId) continue;
            await this.notificationService.create(
                owner.userId,
                'CHANGE_REQUEST',
                'Änderung zur Bestätigung',
                `${author?.username || 'Ein Nutzer'} hat „${summary}“ vorgeschlagen.`,
                changeRequest.id
            );
        }

        return changeRequest;
    }

    async listForOwner(treeId: string) {
        return this.prisma.changeRequest.findMany({
            where: { treeId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, username: true } } }
        });
    }

    async listForUser(userId: string) {
        return this.prisma.changeRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { tree: { select: { id: true, name: true, title: true } } }
        });
    }

    async approve(treeId: string, id: string, reviewedById: string) {
        const cr = await this.prisma.changeRequest.findFirst({ where: { id, treeId, status: 'PENDING' } });
        if (!cr) throw new Error('Änderungsantrag nicht gefunden oder bereits bearbeitet.');

        if (cr.entityType === 'PERSON') {
            const personRepo = new PersonRepository(this.prisma);
            const auditService = new AuditService(this.prisma);
            const notesService = new NotesService(this.prisma);
            const personWriteService = new PersonWriteService(personRepo, auditService, notesService);
            const beforeState = cr.entityId ? await personRepo.findById(cr.entityId, cr.treeId) : null;
            await personWriteService.updatePerson({ ...(cr.payload as any), treeId: cr.treeId, beforeState }, reviewedById);
        } else if (cr.entityType === 'FAMILY') {
            const familyRepo = new FamilyRepository(this.prisma);
            const auditService = new AuditService(this.prisma);
            const familyWriteService = new FamilyWriteService(familyRepo, auditService);
            const beforeState = cr.entityId ? await familyRepo.findById(cr.entityId, cr.treeId) : null;
            await familyWriteService.saveFamily(cr.treeId, { ...(cr.payload as any), beforeState }, reviewedById);
        } else {
            throw new Error('Dieser Entitätstyp kann (noch) nicht bestätigt werden.');
        }

        await this.prisma.changeRequest.update({ where: { id }, data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById } });
        await this.notificationService.create(cr.userId, 'CHANGE_REQUEST', 'Änderung bestätigt', `Deine Änderung „${cr.summary}“ wurde bestätigt.`, cr.id);
        return true;
    }

    async reject(treeId: string, id: string, reviewedById: string, reason?: string) {
        const cr = await this.prisma.changeRequest.findFirst({ where: { id, treeId, status: 'PENDING' } });
        if (!cr) throw new Error('Änderungsantrag nicht gefunden oder bereits bearbeitet.');

        const reasonText = (reason || '').trim();
        await this.prisma.changeRequest.update({
            where: { id },
            data: { status: 'REJECTED', rejectReason: reasonText || null, reviewedAt: new Date(), reviewedById }
        });

        if (reasonText) {
            await this.prisma.conversationMessage.create({ data: { changeRequestId: id, senderId: reviewedById, body: reasonText } });
        }

        await this.notificationService.create(
            cr.userId,
            'CHANGE_REQUEST',
            'Änderung abgelehnt',
            reasonText ? `Deine Änderung „${cr.summary}“ wurde abgelehnt: ${reasonText}` : `Deine Änderung „${cr.summary}“ wurde abgelehnt.`,
            cr.id
        );
        return true;
    }

    async cancel(treeId: string, id: string, userId: string) {
        const cr = await this.prisma.changeRequest.findFirst({ where: { id, treeId, status: 'PENDING', userId } });
        if (!cr) throw new Error('Änderungsantrag nicht gefunden oder bereits bearbeitet.');
        await this.prisma.changeRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        return true;
    }

    async cancelById(id: string, userId: string) {
        const cr = await this.prisma.changeRequest.findFirst({ where: { id, status: 'PENDING', userId } });
        if (!cr) throw new Error('Änderungsantrag nicht gefunden oder bereits bearbeitet.');
        await this.prisma.changeRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
        return true;
    }

    async getChangeRequest(changeRequestId: string, userId: string) {
        return this.prisma.changeRequest.findFirst({
            where: {
                id: changeRequestId,
                OR: [
                    { userId },
                    { tree: { permissions: { some: { userId, level: 'OWNER' } } } }
                ]
            },
            include: {
                user: { select: { id: true, username: true } },
                tree: { select: { id: true, name: true, title: true } },
                messages: { orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, username: true } } } }
            }
        });
    }

    async addMessage(changeRequestId: string, senderId: string, body: string) {
        const cr = await this.prisma.changeRequest.findFirst({
            where: {
                id: changeRequestId,
                OR: [
                    { userId: senderId },
                    { tree: { permissions: { some: { userId: senderId, level: 'OWNER' } } } }
                ]
            }
        });
        if (!cr) throw new Error('Änderungsantrag nicht gefunden oder kein Zugriff.');

        const message = await this.prisma.conversationMessage.create({
            data: { changeRequestId, senderId, body: body.trim() }
        });

        const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
        if (cr.userId === senderId) {
            // Proposer replies → notify the owner(s).
            const owners = await this.prisma.treePermission.findMany({ where: { treeId: cr.treeId, level: 'OWNER' }, select: { userId: true } });
            for (const owner of owners) {
                if (owner.userId === senderId) continue;
                await this.notificationService.create(owner.userId, 'CHANGE_REQUEST', 'Neue Antwort', `${sender?.username || 'Jemand'} hat geantwortet.`, cr.id);
            }
        } else {
            // Owner/reviewer replies → notify the proposer.
            await this.notificationService.create(cr.userId, 'CHANGE_REQUEST', 'Neue Antwort', `${sender?.username || 'Jemand'} hat geantwortet.`, cr.id);
        }

        return message;
    }

    async listRelevant(userId: string) {
        return this.prisma.changeRequest.findMany({
            where: {
                OR: [
                    { userId },
                    { tree: { permissions: { some: { userId, level: 'OWNER' } } } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, username: true } },
                tree: { select: { id: true, name: true, title: true } },
                _count: { select: { messages: true } }
            }
        });
    }
}
