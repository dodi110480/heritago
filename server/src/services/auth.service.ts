import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { MailService } from './mail.service';
import { InvitationService } from './invitation.service';
import { validatePassword } from '../shared/password-policy';

const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export class AuthService {
    private readonly SALT_ROUNDS = 12;
    private mailService: MailService;
    private invitationService: InvitationService;

    constructor(private prisma: PrismaClient) {
        this.mailService = new MailService();
        this.invitationService = new InvitationService(prisma);
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private makeToken(): { token: string; hashed: string } {
        const token = crypto.randomBytes(32).toString('hex');
        return { token, hashed: this.hashToken(token) };
    }

    private throwAuthError(message: string, code: string, statusCode = 403): never {
        const err: any = new Error(message);
        err.code = code;
        err.statusCode = statusCode;
        throw err;
    }

    async validateUser(username: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { username } });

        // Generic failure for unknown user (no user enumeration).
        if (!user || !user.password) return null;

        if (user.isSuspended) {
            this.throwAuthError('Dieses Konto ist gesperrt.', 'AUTH_ACCOUNT_SUSPENDED');
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            this.throwAuthError('Dieses Konto ist vorübergehend gesperrt. Bitte versuche es später erneut.', 'AUTH_ACCOUNT_LOCKED');
        }
        if (!user.isEmailVerified) {
            this.throwAuthError('Bitte verifiziere zuerst deine E-Mail-Adresse.', 'AUTH_EMAIL_NOT_VERIFIED');
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            const attempts = user.failedLoginAttempts + 1;
            const data: any = { failedLoginAttempts: attempts };
            if (attempts >= MAX_LOGIN_ATTEMPTS) {
                data.failedLoginAttempts = 0;
                data.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
            }
            await this.prisma.user.update({ where: { id: user.id }, data });
            return null;
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null }
        });

        return {
            id: user.id,
            username: user.username,
            email: user.email,
            globalRole: user.globalRole,
            isAdmin: user.globalRole === 'ADMIN'
        };
    }

    async registerUser(data: { username: string; email: string; password: string }) {
        const { username, email, password } = data;

        const existingUser = await this.prisma.user.findFirst({
            where: { OR: [{ username }, { email }] }
        });
        if (existingUser) {
            throw new Error('Benutzername oder Email bereits vergeben.');
        }

        const pwError = validatePassword(password, { username, email });
        if (pwError) throw new Error(pwError);

        const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
        const { token, hashed } = this.makeToken();

        const user = await this.prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                globalRole: 'USER',
                verificationCode: hashed,
                verificationExpiresAt: new Date(Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000)
            }
        });

        await this.mailService.sendMail({
            to: email,
            subject: 'E-Mail-Adresse verifizieren',
            text: `Hallo ${username},\n\nbitte verifiziere deine E-Mail-Adresse mit folgendem Link:\n\n${this.verificationUrl(token)}\n\nDer Link ist ${VERIFICATION_TTL_HOURS} Stunden gültig.`
        });

        return { id: user.id, username: user.username, email: user.email, isAdmin: false };
    }

    private verificationUrl(token: string): string {
        const base = process.env.APP_URL || 'http://localhost:4200';
        return `${base}/verify-email?token=${token}`;
    }

    private resetUrl(token: string): string {
        const base = process.env.APP_URL || 'http://localhost:4200';
        return `${base}/reset-password?token=${token}`;
    }

    async verifyEmail(token: string): Promise<boolean> {
        const hashed = this.hashToken(token);
        const user = await this.prisma.user.findFirst({ where: { verificationCode: hashed } });
        if (!user) return false;
        if (user.verificationExpiresAt && user.verificationExpiresAt < new Date()) return false;

        await this.prisma.user.update({
            where: { id: user.id },
            data: { isEmailVerified: true, verificationCode: null, verificationExpiresAt: null }
        });

        // Claim any open invitations for this (now verified) email address.
        await this.invitationService.claimInvitationsForEmail(user.email, user.id);

        return true;
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) return; // generic response (no user enumeration)

        const { token, hashed } = this.makeToken();
        await this.prisma.user.update({
            where: { id: user.id },
            data: { resetToken: hashed, resetExpiresAt: new Date(Date.now() + RESET_TTL_HOURS * 60 * 60 * 1000) }
        });

        await this.mailService.sendMail({
            to: user.email,
            subject: 'Passwort zurücksetzen',
            text: `Hallo ${user.username},\n\nsetze dein Passwort mit folgendem Link zurück:\n\n${this.resetUrl(token)}\n\nDer Link ist ${RESET_TTL_HOURS} Stunde gültig.`
        });
    }

    async resetPassword(token: string, newPassword: string): Promise<boolean> {
        const hashed = this.hashToken(token);
        const user = await this.prisma.user.findFirst({ where: { resetToken: hashed } });
        if (!user) return false;
        if (user.resetExpiresAt && user.resetExpiresAt < new Date()) return false;

        const pwError = validatePassword(newPassword, { username: user.username, email: user.email });
        if (pwError) throw new Error(pwError);

        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword, resetToken: null, resetExpiresAt: null, failedLoginAttempts: 0, lockedUntil: null }
        });
        return true;
    }

    async getUsers() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                email: true,
                globalRole: true,
                isEmailVerified: true,
                isSuspended: true,
                maxTrees: true,
                createdAt: true,
                _count: {
                    select: { permissions: { where: { level: 'OWNER' } } }
                }
            }
        });
    }

    async deleteUser(id: string) {
        // Prevent orphaned trees: block deletion while this user is the sole OWNER
        // of one or more trees (those trees would become unreachable after the
        // cascade removes the TreePermission). The admin must transfer or delete
        // them first via the tree administration.
        const ownedPermissions = await this.prisma.treePermission.findMany({
            where: { userId: id, level: 'OWNER' },
            select: { treeId: true }
        });

        const orphanedTrees: string[] = [];
        for (const { treeId } of ownedPermissions) {
            const ownerCount = await this.prisma.treePermission.count({
                where: { treeId, level: 'OWNER' }
            });
            if (ownerCount <= 1) {
                const tree = await this.prisma.tree.findUnique({ where: { id: treeId } });
                orphanedTrees.push(tree?.title || tree?.name || treeId);
            }
        }

        if (orphanedTrees.length > 0) {
            const label = orphanedTrees.length === 1 ? 'Stammbaum' : 'Stammbäume';
            this.throwAuthError(
                `Der Benutzer ist noch alleiniger Besitzer von ${orphanedTrees.length} ${label} (${orphanedTrees.join(', ')}). Bitte übertrage oder lösche diese zuerst in der Stammbaumverwaltung.`,
                'ADMIN_USER_OWNS_TREES',
                409
            );
        }

        return this.prisma.user.delete({ where: { id } });
    }

    async updateUserRole(id: string, role: string) {
        return this.prisma.user.update({
            where: { id },
            data: { globalRole: role as any }
        });
    }

    async setUserSuspended(id: string, suspended: boolean) {
        return this.prisma.user.update({ where: { id }, data: { isSuspended: suspended } });
    }

    async setUserMaxTrees(id: string, maxTrees: number) {
        return this.prisma.user.update({ where: { id }, data: { maxTrees } });
    }
}
