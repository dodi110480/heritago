// server/src/shared/formatters/place.formatter.ts

export class PlaceFormatter {
    static formatPlaceForClient(place: any) {
        if (!place) return null;
        return {
            ...place,
            notes: (place.noteLinks || []).map((nl: any) => ({
                id: nl.note?.id,
                text: nl.note?.text || '',
                noteType: nl.note?.noteType || 'OTHER',
                privacyLevel: nl.note?.privacyLevel || 'PRIVATE',
                isPrivate: nl.note?.privacyLevel === 'PRIVATE'
            }))
        };
    }
}
