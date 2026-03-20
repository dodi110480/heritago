// server/src/services/media/media.write.service.ts
import { MediaRepository } from '../../repositories/media.repository';
import { IAuditService } from '../../interfaces/audit.service.interface';
import { MediaFormatter } from '../../shared/formatters/media.formatter';

export class MediaWriteService {
    constructor(
        private mediaRepository: MediaRepository,
        private auditService: IAuditService
    ) {}

    async saveMedia(treeId: string, data: any, userId?: string) {
        const result = await this.mediaRepository.saveMedia({ ...data, treeId });
        
        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                data.id ? 'UPDATE' : 'CREATE',
                'MEDIA',
                result.id
            );
        }
        
        return MediaFormatter.formatMediaForClient(result);
    }

    async deleteMedia(id: string, treeId: string, userId?: string) {
        const result = await this.mediaRepository.deleteMedia(id, treeId);
        
        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                'DELETE',
                'MEDIA',
                id
            );
        }
        
        return result;
    }
}
