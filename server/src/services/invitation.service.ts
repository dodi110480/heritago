import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { MailService } from './mail.service';

const INVITATION_TTL_HOURS = 24 * 7; // 7 days
const ALLOWED_LEVELS = ['VIEWER', 'EDITOR', 'COMMENTER'];

export class InvitationService {
    private mailService: MailService;

    constructor(private prisma: PrismaClient) {
        this.mailService = new MailService();
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    async invite(treeId: string, email: string, level: string, invitedById?: string) {
        if (!ALLOWED_LEVELS.includes(level)) {
            const err: any = new Error('Ungültige Rolle.');
            err.statusCode = 400;
            throw err;
        }
        const normalizedEmail = (email || '').trim().toLowerCase();
        if (!normalizedEmail || !normalizedEmail.includes('@')) {
            const err: any = new Error('Ungültige E-Mail-Adresse.');
            err.statusCode = 400;
            throw err;
        }

        const existing = await this.prisma.invitation.findFirst({
            where: { treeId, email: normalizedEmail, claimedAt: null, expiresAt: { gt: new Date() } }
        });
        if (existing) {
            const err: any = new Error('Für diese E-Mail existiert bereits eine offene Einladung.');
            err.statusCode = 409;
            throw err;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const invitation = await this.prisma.invitation.create({
            data: {
                treeId,
                email: normalizedEmail,
                level: level as any,
                tokenHash: this.hashToken(token),
                invitedById: invitedById || null,
                expiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000)
            }
        });

        const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });

        await this.mailService.sendMail({
            to: normalizedEmail,
            subject: `Einladung zum Stammbaum "${tree?.title || tree?.name}"`,
            text: `Hallo,\n\ndu wurdest eingeladen, am Stammbaum "${tree?.title || tree?.name}" mitzuarbeiten.\n\nRegistriere dich mit dieser E-Mail-Adresse auf Heritago und verifiziere deine E-Mail – danach wird dir der Baum automatisch freigeschaltet.\n\nDie Einladung ist ${INVITATION_TTL_HOURS / 24} Tage gültig.`
        });

        return invitation;
    }

    async listInvitations(treeId: string) {
        return this.prisma.invitation.findMany({
            where: { treeId, claimedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true, level: true, createdAt: true, expiresAt: true }
        });
    }

    async revokeInvitation(treeId: string, id: string) {
        const invitation = await this.prisma.invitation.findFirst({ where: { id, treeId } });
        if (!invitation) {
            const err: any = new Error('Einladung nicht gefunden.');
            err.statusCode = 404;
            throw err;
        }
        await this.prisma.invitation.delete({ where: { id } });
        return true;
    }

    /**
     * Converts all open invitations for the given (verified) email address into
     * TreePermissions for the user. Called after email verification.
     */
    async claimInvitationsForEmail(email: string, userId: string): Promise<number> {
        const normalizedEmail = (email || '').trim().toLowerCase();
        const open = await this.prisma.invitation.findMany({
            where: { email: normalizedEmail, claimedAt: null, expiresAt: { gt: new Date() } }
        });

        for (const inv of open) {
            await this.prisma.treePermission.upsert({
                where: { treeId_userId: { treeId: inv.treeId, userId } },
                update: {},
                create: { treeId: inv.treeId, userId, level: inv.level }
            });
            await this.prisma.invitation.update({ where: { id: inv.id }, data: { claimedAt: new Date() } });
        }

        return open.length;
    }
}
