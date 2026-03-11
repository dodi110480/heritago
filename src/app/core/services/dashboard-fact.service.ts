import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class DashboardFactService {

    generateFact(people: any[], families: any[], completeness: number): string {
        if (!people || people.length === 0) {
            return 'Starte deine Reise in die Vergangenheit.';
        }

        const logikas = [
            // 1. Ältester Ahn
            () => {
                const sorted = [...people]
                    .filter(p => p.birthDate && /\d{4}$/.test(p.birthDate))
                    .sort((a, b) => {
                        const yearA = parseInt(a.birthDate.match(/\d{4}$/)![0]);
                        const yearB = parseInt(b.birthDate.match(/\d{4}$/)![0]);
                        return yearA - yearB;
                    });
                return sorted.length > 0 ? `„${sorted[0].firstName} ${sorted[0].lastName} ist aktuell dein ältester dokumentierter Ahn (${sorted[0].birthDate.match(/\d{4}$/)![0]}).“` : null;
            },

            // 2. Namensstatistik
            () => {
                const names: Record<string, number> = {};
                people.forEach(p => { if (p.lastName) names[p.lastName] = (names[p.lastName] || 0) + 1; });
                const top = Object.entries(names).sort((a, b) => b[1] - a[1])[0];
                return top ? `„Der häufigste Nachname in deinem Stammbaum ist ${top[0]} (${top[1]} Mal).“` : null;
            },

            // 3. Geschlechterverteilung
            () => {
                const men = people.filter(p => p.gender === 'M').length;
                const women = people.filter(p => p.gender === 'F').length;
                return men > 0 && women > 0 ? `„In deinem Baum finden sich aktuell ${men} Männer und ${women} Frauen.“` : null;
            },

            // 4. Vollständigkeit
            () => completeness > 0 ? `„Dein Forschungsgrad liegt bei ${completeness}% vollständig dokumentierten Datensätzen.“` : null,

            // 5. Fehlende Geburtsdaten
            () => {
                const missing = people.filter(p => !p.birthDate).length;
                return missing > 5 ? `„Bei ${missing} Personen fehlt noch ein dokumentiertes Geburtsdatum – eine gute Gelegenheit für neue Recherchen!“` : null;
            },

            // 6. Orte
            () => {
                const places = new Set(people.flatMap(p => [p.birthPlace, p.deathPlace]).filter(Boolean));
                return places.size > 3 ? `„Deine Familiengeschichte erstreckt sich bereits über ${places.size} dokumentierte Orte.“` : null;
            },

            // 7. Zuletzt hinzugefügt/bearbeitet (via updatedAt)
            () => {
                const sorted = [...people]
                    .filter(p => p.updatedAt)
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                return sorted.length > 0 ? `„Zuletzt am Stammbaum gearbeitet: ${sorted[0].firstName} ${sorted[0].lastName} wurde aktualisiert.“` : null;
            },

            // 8. Altersrekord (nutzt birthDate/deathDate)
            () => {
                let maxAge = 0;
                let oldestPerson = '';
                people.forEach(p => {
                    if (p.birthDate && p.deathDate) {
                        const bYear = parseInt(p.birthDate.match(/\d{4}$/)?.[0] || '');
                        const dYear = parseInt(p.deathDate.match(/\d{4}$/)?.[0] || '');
                        if (bYear && dYear && (dYear - bYear) > maxAge && (dYear - bYear) < 115) {
                            maxAge = dYear - bYear;
                            oldestPerson = `${p.firstName} ${p.lastName}`;
                        }
                    }
                });
                return maxAge > 30 ? `„Den Altersrekord in deiner Familie hält ${oldestPerson} mit beeindruckenden ${maxAge} Jahren.“` : null;
            },

            // 9. Kleine Weisheiten & GEDCOM Info
            () => `„Ahnenforschung – das einzige Hobby, bei dem Tote zurückschreiben.“`,
            () => `„Jeder Eintrag bringt deine Geschichte ein Stück näher ans Licht.“`,
            () => `„Deine Familie war schon da, als es noch keine Hausnummern gab.“`,
            () => `„Wusstest du? Dein Stammbaum wird im modernen GEDCOM 7.0 Format verwaltet.“`,
            () => `„Zwischen dir und dem Anfang deiner Forschung liegen oft hunderte Jahre Geschichte.“`
        ];

        // Filter null results and pick random
        const validFacts = logikas.map(l => l()).filter(f => f !== null) as string[];
        const randomIdx = Math.floor(Math.random() * validFacts.length);
        return validFacts[randomIdx];
    }
}
