// server/src/interfaces/audit.service.interface.ts
export interface IAuditService {
    logAction(treeId: string, userId: string, action: string, entityType: string, entityId: string, details?: any): Promise<void>;
}
