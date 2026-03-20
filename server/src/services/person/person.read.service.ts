import { PersonRepository } from '../../repositories/person.repository';
import { PersonFormatter } from '../../shared/formatters/person.formatter';

export class PersonReadService {
    constructor(private personRepository: PersonRepository) {}

    async getFullProfile(personId: string, treeId: string) {
        const person = await this.personRepository.getPersonWithRelations(personId, treeId);
        if (!person) return null;

        return PersonFormatter.formatFullProfile(person);
    }

    async getPerson(id: string, treeId: string) {
        const person = await this.personRepository.findById(id, treeId);
        if (!person) return null;
        return PersonFormatter.formatPersonForClient(person);
    }

    async getChildren(personId: string) {
        const children = await this.personRepository.getChildren(personId);
        return children.map((c: any) => PersonFormatter.formatPersonForClient(c.person));
    }

    async getParents(personId: string, treeId: string) {
        const familiesAsChild = await this.personRepository.getFamiliesAsChild(personId);
        const families = familiesAsChild.map((f: any) => f.family);
        
        const parents: any[] = [];
        for (const fam of families) {
            const spouses = await this.personRepository.getSpousesInFamily(fam.id);
            parents.push(...spouses.map((p: any) => PersonFormatter.formatPersonForClient(p.person)));
        }
        return parents;
    }

    async getSpouses(personId: string) {
        const familiesAsSpouse = await this.personRepository.getFamiliesAsSpouse(personId);
        const spouses: any[] = [];
        for (const fam of familiesAsSpouse) {
            const partners = await this.personRepository.getSpousesInFamily(fam.familyId, personId);
            spouses.push(...partners.map((p: any) => PersonFormatter.formatPersonForClient(p.person)));
        }
        return spouses;
    }
}
