import { PrismaClient } from '@prisma/client';

export class NotificationService {
    constructor(private prisma: PrismaClient) {}

    async create(userId: string, type: string, title: string, message: string, entityId?: string) {
        return this.prisma.notification.create({
            data: { userId, type, title, message, entityId: entityId || null }
        });
    }

    async listForUser(userId: string) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
    }

    async unreadCount(userId: string) {
        return this.prisma.notification.count({ where: { userId, readAt: null } });
    }

    async markRead(userId: string, id: string) {
        await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
        return true;
    }

    async markAllRead(userId: string) {
        await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
        return true;
    }
}
