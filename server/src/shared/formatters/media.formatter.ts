// server/src/shared/formatters/media.formatter.ts

export class MediaFormatter {
    static formatMediaForClient(m: any) {
        if (!m) return null;
        return {
            ...m,
            notes: (m.noteLinks || []).map((nl: any) => nl.note).filter(Boolean),
            formattedNotes: this.formatNotesForClient(m.noteLinks || []),
            formattedCitations: this.formatCitationsForClient(m.citations || [])
        };
    }

    static formatNotesForClient(noteLinks: any[]): any[] {
        if (!noteLinks) return [];
        return noteLinks.map(nl => {
            const n = nl.note;
            if (!n) return null;
            return {
                id: n.id,
                text: n.text,
                noteType: n.noteType,
                isPrivate: n.privacyLevel === 'PRIVATE',
                date: n.createdAt ? n.createdAt.toLocaleDateString('de-DE') : ''
            };
        }).filter(Boolean);
    }

    static formatCitationsForClient(citations: any[]): any[] {
        if (!citations) return [];
        return citations.map(c => {
            return {
                id: c.id,
                sourceId: c.sourceId,
                title: c.source?.title || 'Unbekannte Quelle',
                whereInSource: c.page || '',
                confidenceLabel: c.confidence === 'CERTAIN' ? 'Sicher' : 
                                 c.confidence === 'VERY_LIKELY' ? 'Sehr wahrscheinlich' :
                                 c.confidence === 'LIKELY' ? 'Wahrscheinlich' : 'Unzuverlässig'
            };
        });
    }
}
