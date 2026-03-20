// server/src/shared/date.utils.ts

export class DateUtils {
    /**
     * Parse a genealogical date string into a sortable integer (YYYYMMDD).
     * Handles formats like "DD MMM YYYY", "MMM YYYY", and "YYYY".
     */
    static parseDate(s?: string): number {
        const months: Record<string, number> = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };

        if (!s) return 99991231;
        
        // Try DD MMM YYYY
        const dmy = s.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
        if (dmy) {
            const day = dmy[1].padStart(2, '0');
            const month = (months[dmy[2].toUpperCase()] ?? 0).toString().padStart(2, '0');
            const year = dmy[3];
            return parseInt(`${year}${month}${day}`);
        }

        // Try MMM YYYY
        const my = s.match(/([A-Z]{3})\s+(\d{4})/i);
        if (my) {
            const month = (months[my[1].toUpperCase()] ?? 0).toString().padStart(2, '0');
            const year = my[2];
            return parseInt(`${year}${month}01`);
        }

        // Try YYYY
        const y = s.match(/(\d{4})/);
        if (y) {
            return parseInt(`${y[1]}0001`);
        }

        return 99991231;
    }

    /**
     * Compare two genealogical date strings.
     */
    static compareDates(d1?: string, d2?: string): number {
        return this.parseDate(d1) - this.parseDate(d2);
    }

    /**
     * Get sorting weight for a tag (Birth first, Death last).
     */
    static getSortWeight(tag: string): number {
        const weights: Record<string, number> = {
            "BIRT": -100, // Birth always first
            "DEAT": 100,  // Death towards the end
            "BURI": 110,  // Burial after death
            "CREM": 111,
            "MARR": 10    // Marriage normally after birth
        };
        return weights[tag || ''] || 0;
    }

    /**
     * Full comparison logic for timeline items.
     */
    static compareTimelineItems(a: any, b: any): number {
        const dateCmp = this.compareDates(a.date || a.dateText, b.date || b.dateText);
        if (dateCmp !== 0) return dateCmp;
        return this.getSortWeight(a.tag || a.type) - this.getSortWeight(b.tag || b.type);
    }
}
