// server/src/interfaces/notes.service.interface.ts
export interface INotesService {
    getNotesForEntity(entityId: string): Promise<any[]>;
    // Add other methods as needed based on notes.service.ts
}
