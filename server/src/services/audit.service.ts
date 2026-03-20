import { PrismaClient, EntityType, ChangeAction } from '@prisma/client';
import { IAuditService } from '../interfaces/audit.service.interface';

export class AuditService implements IAuditService {
    constructor(private prisma: PrismaClient) {}

    async logAction(treeId: string, userId: string, action: string, entityType: string, entityId: string, details?: any): Promise<void> {
        await this.logChange({
            treeId,
            userId,
            action: action as ChangeAction,
            entityType: entityType as EntityType,
            entityId,
            before: details?.before,
            after: details?.after,
            summary: details?.summary,
            reason: details?.reason
        });
    }

    async logChange(params: {
        treeId: string;
        userId?: string;
        action: ChangeAction;
        entityType: EntityType;
        entityId: string;
        before?: any;
        after?: any;
        summary?: string;
        reason?: string;
    }, tx?: any) {
        const { treeId, userId, action, entityType, entityId, before, after, summary, reason } = params;

        let finalSummary = summary;
        if (!finalSummary) {
            const actionText = action === 'CREATE' ? 'erstellt' : (action === 'DELETE' ? 'gelöscht' : 'aktualisiert');
            const entityText = entityType.charAt(0) + entityType.slice(1).toLowerCase();
            finalSummary = `${entityText} ${actionText}`;
        }

        const client = tx || this.prisma;
        return client.changeLog.create({
            data: {
                treeId,
                userId: userId || null,
                action,
                entityType,
                entityId,
                before: before as any,
                after: after as any,
                summary: finalSummary,
                reason: reason || null
            }
        });
    }

    /**
     * Helper to get names for person/family log summaries
     */
    static getEntityLabel(entity: any, type: EntityType): string {
        if (type === 'PERSON') {
            const primaryName = entity.names?.find((n: any) => n.isPrimary) || entity.names?.[0];
            return `${primaryName?.given || ''} ${primaryName?.surname || ''}`.trim() || entity.gedcomId || entity.id;
        }
        if (type === 'FAMILY') {
            return entity.gedcomId || entity.id;
        }
        if (type === 'PLACE') {
            return entity.name;
        }
        if (type === 'MEDIA') {
            return entity.title || entity.path;
        }
        return entity.id;
    }

    private static getEntityTypeLabel(type: EntityType): string {
        switch (type) {
            case 'PERSON': return 'Person';
            case 'FAMILY': return 'Familie';
            case 'PLACE': return 'Ort';
            case 'MEDIA': return 'Medium';
            case 'SOURCE': return 'Quelle';
            case 'REPOSITORY': return 'Archiv';
            default: return type;
        }
    }

    private static getEntityIcon(type: EntityType): string {
        switch (type) {
            case 'PERSON': return '👤';
            case 'FAMILY': return '👨‍👩‍👧‍👦';
            case 'PLACE': return '📍';
            case 'MEDIA': return '🖼️';
            case 'SOURCE': return '📜';
            default: return '📄';
        }
    }

    private static getEntityColor(type: EntityType): string {
        switch (type) {
            case 'PERSON': return 'text-brand-400';
            case 'FAMILY': return 'text-accent-emerald-400';
            case 'PLACE': return 'text-accent-amber-400';
            case 'MEDIA': return 'text-accent-cyan-400';
            default: return 'text-canvas-white/30';
        }
    }

    async getChangeLog(treeId: string) {
        const logs = await this.prisma.changeLog.findMany({
            where: { treeId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        const formattedLogs = logs.map(log => ({
            ...log,
            entityTypeLabel: AuditService.getEntityTypeLabel(log.entityType),
            entityIcon: AuditService.getEntityIcon(log.entityType),
            entityColorClass: AuditService.getEntityColor(log.entityType)
        }));

        // Group by date with localized labels on server
        const groups: { [key: string]: any[] } = {};
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;

        formattedLogs.forEach(log => {
            const date = new Date(log.createdAt);
            const logDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
            
            let label = date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
            if (logDay === today) label = 'Heute';
            else if (logDay === yesterday) label = 'Gestern';

            if (!groups[label]) groups[label] = [];
            groups[label].push(log);
        });

        return Object.entries(groups).map(([label, items]) => ({
            dateLabel: label,
            logs: items
        }));
    }
}
