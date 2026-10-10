/**
 * Shared mapping between the stored citation confidence (`ConfidenceLevel`) and the GEDCOM 7.0
 * quality level `QUAY` (0–3). The UI works with the numeric quality level, the database keeps both
 * representations in sync so that exports and the edit dialogs stay consistent.
 */

/** GEDCOM `QUAY` level for a stored confidence value. */
export function confidenceToQuay(confidence?: string | null): number | null {
    switch (confidence) {
        case 'CERTAIN': return 3;
        case 'VERY_LIKELY': return 2;
        case 'LIKELY':
        case 'POSSIBLE': return 1;
        case 'UNLIKELY': return 0;
        default: return null;
    }
}

/** Stored confidence value for a GEDCOM `QUAY` level. */
export function quayToConfidence(quay?: number | null): string | null {
    switch (quay) {
        case 3: return 'CERTAIN';
        case 2: return 'VERY_LIKELY';
        case 1: return 'LIKELY';
        case 0: return 'UNLIKELY';
        default: return null;
    }
}

/** Reads the quality level from a citation payload (explicit `quay` or the UI field `quality`). */
export function resolveCitationQuay(citation: any): number | null {
    const raw = citation?.quay ?? citation?.quality;
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    return Number.isInteger(value) && value >= 0 && value <= 3 ? value : null;
}
