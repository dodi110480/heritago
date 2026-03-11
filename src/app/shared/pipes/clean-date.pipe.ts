import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'cleanDate',
    standalone: true
})
export class CleanDatePipe implements PipeTransform {
    transform(value: string | undefined | null): string {
        if (!value) return '';
        // Entfernt gängige GEDCOM-Präfixe wie ABT, EST, CAL, BEF, AFT für die Anzeige
        return value.replace(/^(ABT|EST|CAL|BEF|AFT)\s+/i, '').trim();
    }
}
