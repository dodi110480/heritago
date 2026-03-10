export class NotesService {
    static async processSharedNotes(tx: any, treeId: string, notes: any[], entityLinks: any, currentUserId?: string) {
        if (!notes || !Array.isArray(notes)) return;


        // Clean existing note links for this entity (except for events/facts which are usually recreated)
        if (entityLinks.personId && !entityLinks.eventId && !entityLinks.factId) {
            await tx.noteLink.deleteMany({ where: { treeId, personId: entityLinks.personId, eventId: null, factId: null } });
        } else if (entityLinks.familyId && !entityLinks.eventId) {
            await tx.noteLink.deleteMany({ where: { treeId, familyId: entityLinks.familyId, eventId: null } });
        } else if (entityLinks.sourceId) {
            await tx.noteLink.deleteMany({ where: { treeId, sourceId: entityLinks.sourceId } });
        } else if (entityLinks.placeId) {
            await tx.noteLink.deleteMany({ where: { treeId, placeId: entityLinks.placeId } });
        } else if (entityLinks.citationId) {
            await tx.noteLink.deleteMany({ where: { treeId, citationId: entityLinks.citationId } });
        }

        for (const noteData of notes) {
            const isString = typeof noteData === 'string';
            const noteText = isString ? noteData : (noteData?.text || '');
            if (!noteText.trim()) continue;

            const noteType = isString ? 'OTHER' : (noteData?.noteType || 'OTHER');
            const pLevel: 'PRIVATE' | 'PUBLIC' = (!isString && (noteData?.isPrivate || noteData?.privacyLevel === 'PRIVATE')) ? 'PRIVATE' : 'PUBLIC';
            
            let note;
            // Attempt to update by ID if available
            if (!isString && noteData?.id && !noteData.id.startsWith('note-')) {
                note = await tx.sharedNote.findUnique({ where: { id: noteData.id } });
                if (note) {
                    note = await tx.sharedNote.update({
                        where: { id: note.id },
                        data: { 
                            text: noteText, 
                            noteType, 
                            privacyLevel: pLevel,
                            updatedAt: new Date()
                        }
                    });
                }
            }

            if (!note) {
                note = await tx.sharedNote.create({
                    data: {
                        treeId,
                        text: noteText,
                        noteType,
                        privacyLevel: pLevel,
                        userId: currentUserId || null
                    }
                });
            }


            await tx.noteLink.create({
                data: {
                    treeId,
                    ...entityLinks,
                    noteId: note.id
                }
            });
        }
    }
}
