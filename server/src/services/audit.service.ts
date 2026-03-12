import { PrismaClient, EntityType, ChangeAction } from '@prisma/client';

export class AuditService {
    constructor(private prisma: PrismaClient) {}

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
    }) {
        const { treeId, userId, action, entityType, entityId, before, after, summary, reason } = params;

        let finalSummary = summary;
        if (!finalSummary) {
            const actionText = action === 'CREATE' ? 'erstellt' : (action === 'DELETE' ? 'gelöscht' : 'aktualisiert');
            const entityText = entityType.charAt(0) + entityType.slice(1).toLowerCase();
            finalSummary = `${entityText} ${actionText}`;
        }

        return this.prisma.changeLog.create({
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
}
