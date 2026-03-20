import { FamilyRepository } from '../../repositories/family.repository';
import { FamilyFormatter } from '../../shared/formatters/family.formatter';
import { PersonFormatter } from '../../shared/formatters/person.formatter';

export class FamilyReadService {
    constructor(private familyRepository: FamilyRepository) {}

    async getFullProfile(familyId: string, treeId: string) {
        const family = await this.familyRepository.findById(familyId, treeId);
        if (!family) return null;

        const formattedFamily = FamilyFormatter.formatFamilyForClient(family);
        const members = (family.familyMembers || []).map((fm: any) => 
            PersonFormatter.formatPersonForClient(fm.person)
        );

        return {
            family: formattedFamily,
            members
        };
    }
}
