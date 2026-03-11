import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe to format complex place hierarchy strings.
 * 
 * Modes:
 * - 'short': Extracts the local name (last part of comma-separated string).
 * - 'full': Returns the full hierarchy.
 * - 'branded': Prioritizes the 'phrase' field, falls back to 'short'.
 */
@Pipe({
    name: 'placeDisplay',
    standalone: true
})
export class PlaceDisplayPipe implements PipeTransform {
    transform(value: string | any, mode: 'short' | 'full' | 'branded' = 'branded', phrase?: string): string {
        if (!value) return '';

        // If we get a whole object, use its properties
        let nameString = typeof value === 'string' ? value : value.name || '';
        let description = phrase || (typeof value === 'object' ? value.phrase : '');

        if (mode === 'branded' && description) {
            return description;
        }

        if (mode === 'short' || mode === 'branded') {
            const parts = nameString.split(',').map((p: string) => p.trim());
            return parts[parts.length - 1] || nameString;
        }

        return nameString;
    }
}
