// server/src/services/place/place.write.service.ts
import { PlaceRepository } from '../../repositories/place.repository';
import { IAuditService } from '../../interfaces/audit.service.interface';

export class PlaceWriteService {
    constructor(
        private placeRepository: PlaceRepository,
        private auditService: IAuditService
    ) {}

    async savePlace(treeId: string, data: any, userId?: string) {
        // Logic for saving place (nested identifiers/notes would be handled here or in repo)
        const result = await this.placeRepository.savePlace({ ...data, treeId });
        
        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                data.id ? 'UPDATE' : 'CREATE',
                'PLACE',
                result.id
            );
        }
        
        return result;
    }

    async deletePlace(id: string, treeId: string, userId?: string) {
        const result = await this.placeRepository.deletePlace(id, treeId);
        
        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                'DELETE',
                'PLACE',
                id
            );
        }
        
        return result;
    }
}
