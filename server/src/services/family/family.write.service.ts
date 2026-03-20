// server/src/services/family/family.write.service.ts
import { FamilyRepository } from '../../repositories/family.repository';
import { IAuditService } from '../../interfaces/audit.service.interface';

export class FamilyWriteService {
    constructor(
        private familyRepository: FamilyRepository,
        private auditService: IAuditService
    ) {}

    async saveFamily(treeId: string, data: any, userId?: string) {
        const familyId = data.id;
        if (!familyId) throw new Error("Family ID is required for save");

        const husbandId = (data.husband || '').trim();
        const wifeId = (data.wife || '').trim();
        const childIds: string[] = Array.isArray(data.children)
            ? Array.from(new Set(data.children.map((c: any) => (c || '').trim()).filter(Boolean)))
            : [];

        // Validate that spouses are not the same person
        if (husbandId && wifeId && husbandId === wifeId) {
            throw new Error('Husband and wife cannot be the same person');
        }

        // Validate that children are not spouses
        if (husbandId && childIds.includes(husbandId)) {
            throw new Error('A spouse cannot be added as child in the same family');
        }
        if (wifeId && childIds.includes(wifeId)) {
            throw new Error('A spouse cannot be added as child in the same family');
        }

        return await (this.familyRepository as any).prisma.$transaction(async (tx: any) => {
            // 1. Save / Upsert the family entity itself
            const result = await this.familyRepository.saveFamily({ ...data, treeId }, tx);

            // 2. Sync Family Members
            await this.familyRepository.deleteMembers(result.id, tx);

            const memberCreates: any[] = [];
            const seenPersonIds = new Set<string>();

            const addMember = (pId: string, role: string, sortOrder: number) => {
                if (!pId || seenPersonIds.has(pId)) return;
                memberCreates.push({
                    familyId: result.id,
                    personId: pId,
                    role: role,
                    sortOrder: sortOrder
                });
                seenPersonIds.add(pId);
            };

            if (husbandId) addMember(husbandId, 'SPOUSE', 0);
            if (wifeId) addMember(wifeId, 'SPOUSE', 1);
            childIds.forEach((cId, idx) => addMember(cId, 'CHILD', 100 + idx));

            if (memberCreates.length > 0) {
                await this.familyRepository.createManyMembers(memberCreates, tx);
            }

            // 3. Audit Logging
            if (userId) {
                await this.auditService.logAction(
                    treeId,
                    userId,
                    data.id ? 'UPDATE' : 'CREATE',
                    'FAMILY',
                    result.id,
                    { before: data.beforeState }
                );
            }

            return result;
        });
    }


    async deleteFamily(id: string, treeId: string, userId?: string) {
        const result = await this.familyRepository.deleteFamily(id, treeId);
        
        if (userId) {
            await this.auditService.logAction(
                treeId,
                userId,
                'DELETE',
                'FAMILY',
                id
            );
        }
        
        return result;
    }
}
