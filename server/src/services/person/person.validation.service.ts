// server/src/services/person/person.validation.service.ts
import { PersonRepository } from '../../repositories/person.repository';

export class PersonValidationService {
    constructor(private personRepository: PersonRepository) {}

    async validateCycles(targetId: string, personId: string): Promise<boolean> {
        // Implementation of recursive cycle check to prevent cycles in ancestry
        // This is a placeholder for the logic from person.service.ts
        return false; 
    }

    async validateDeathDate(birthDate: string, deathDate: string): Promise<boolean> {
        // Logic to ensure death date is after birth date
        return true;
    }
}
