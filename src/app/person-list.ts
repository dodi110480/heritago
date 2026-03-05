import { Component, inject, signal, computed, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { Individual } from './models';
import { FormsModule } from '@angular/forms';
import { CleanDatePipe } from './clean-date.pipe';
import { PersonCreateModal } from './person-create-modal';
import { AppEntityCard } from './ui/app-entity-card';
import { AppPageHeaderComponent } from './ui/app-page-header';
import { AppPageContainerComponent } from './ui/app-page-container';

@Component({
    selector: 'app-person-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, CleanDatePipe, PersonCreateModal, AppEntityCard, AppPageHeaderComponent, AppPageContainerComponent],
    templateUrl: './person-list.html',
    encapsulation: ViewEncapsulation.None
})
export class PersonList {
    private readonly FOCUS_PERSON_KEY = 'heritago_last_focus_person';
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    individuals = signal<Individual[]>([]);
    families = signal<any[]>([]);
    loading = signal(true);
    searchTerm = signal('');
    sortMode = signal<'completion_desc' | 'first_asc' | 'last_asc' | 'family_desc'>('completion_desc');
    sortDirection = signal<'asc' | 'desc'>('desc');
    treeName = signal('');
    focusedPersonId = signal<string>(localStorage.getItem(this.FOCUS_PERSON_KEY) || '');
    isCreating = false;
    showCreateModal = signal(false);

    filteredIndividuals = computed(() => {
        const term = this.searchTerm().toLowerCase();
        const base = this.individuals().filter(person => {
            if (!term) return true;
            return (
                person.name.toLowerCase().includes(term) ||
                person.firstName?.toLowerCase().includes(term) ||
                person.lastName?.toLowerCase().includes(term) ||
                person.id.toLowerCase().includes(term)
            );
        });

        return this.sortIndividuals(base);
    });

    completionById = computed(() => {
        const map = new Map<string, { score: number; missing: string[] }>();
        for (const p of this.individuals()) {
            map.set(p.id, this.computeCompletion(p));
        }
        return map;
    });

    constructor() {
        this.loadPersons();
    }

    createPerson() {
        this.showCreateModal.set(true);
    }

    onPersonCreated(event: any) {
        if (event && event.person) {
            const id = event.person.gedcomId || event.person.id;
            this.rememberFocus(id);
            this.router.navigate(['/person', id]);
        }
    }

    loadPersons() {
        this.loading.set(true);
        this.gedcomService.getTreeData().subscribe({
            next: (data) => {
                if (data) {
                    this.individuals.set(data.individuals);
                    this.families.set(data.families || []);
                    this.treeName.set(data.meta?.tree || '');
                }
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    getLifespan(person: Individual): string {
        const birth = person.birthDate || '';
        const death = person.deathDate || '';
        if (!birth && !death) return '';
        return `${birth} - ${death}`.trim();
    }

    getProfileImage(person: Individual): string {
        if (person.media && person.media.length > 0) {
            const primary = person.media.find(m => m.isPrimary) || person.media[0];
            if (primary?.url) return this.gedcomService.getMediaUrl(primary.url);
        }

        // Fallback to centralized SVGs
        const gender = person.gender === 'M' ? 'male' : (person.gender === 'F' ? 'female' : 'unknown');
        return `assets/avatars/${gender}.svg`;
    }

    rememberFocus(id: string) {
        this.focusedPersonId.set(id);
        localStorage.setItem(this.FOCUS_PERSON_KEY, id);
    }

    private relatedPeopleSet(focusId: string): Set<string> {
        const out = new Set<string>();
        for (const fam of this.families()) {
            const husband = fam.husband || '';
            const wife = fam.wife || '';
            const children: string[] = fam.children || [];
            const isInFamily = husband === focusId || wife === focusId || children.includes(focusId);
            if (!isInFamily) continue;

            if (husband && husband !== focusId) out.add(husband);
            if (wife && wife !== focusId) out.add(wife);
            for (const c of children) {
                if (c && c !== focusId) out.add(c);
            }
        }
        return out;
    }

    private priorityForPerson(id: string, focusId: string, familySet: Set<string>): number {
        if (id === focusId) return 0;
        if (familySet.has(id)) return 1;
        return 2;
    }

    private sortIndividuals(items: Individual[]): Individual[] {
        return [...items].sort((a, b) => this.compareBySortMode(a, b));
    }

    private compareBySortMode(a: Individual, b: Individual): number {
        const mode = this.sortMode();
        const dir = this.sortDirection() === 'asc' ? 1 : -1;
        if (mode === 'first_asc') {
            const cmp = (a.firstName || '').localeCompare(b.firstName || '') || (a.lastName || '').localeCompare(b.lastName || '');
            return cmp * dir;
        }
        if (mode === 'last_asc') {
            const cmp = (a.lastName || '').localeCompare(b.lastName || '') || (a.firstName || '').localeCompare(b.firstName || '');
            return cmp * dir;
        }
        if (mode === 'family_desc') {
            const fa = this.familyLinkCount(a);
            const fb = this.familyLinkCount(b);
            if (fa !== fb) return (fa - fb) * dir;
            return (a.lastName || '').localeCompare(b.lastName || '') * dir;
        }
        // default: completion
        const ca = this.completionFor(a).score;
        const cb = this.completionFor(b).score;
        if (ca !== cb) return (ca - cb) * dir;
        return (a.lastName || '').localeCompare(b.lastName || '') * dir;
    }

    private familyLinkCount(person: Individual): number {
        let count = 0;
        if (Array.isArray(person.parents)) count += person.parents.length;
        if (Array.isArray(person.spouses)) count += person.spouses.length;
        if (Array.isArray(person.familiesAsSpouse)) {
            count += person.familiesAsSpouse.length;
            for (const fam of person.familiesAsSpouse) {
                count += Array.isArray(fam.children) ? fam.children.length : 0;
            }
        }
        return count;
    }

    completionFor(person: Individual): { score: number; missing: string[] } {
        return this.completionById().get(person.id) || { score: 0, missing: [] };
    }

    completionColorClass(score: number): string {
        if (score >= 80) return 'text-accent-emerald-600';
        if (score >= 60) return 'text-accent-emerald-500';
        if (score >= 40) return 'text-accent-highlight-500';
        return 'text-accent-amber-600';
    }

    completionDotClass(score: number): string {
        if (score >= 80) return 'bg-accent-emerald-600';
        if (score >= 60) return 'bg-accent-emerald-500';
        if (score >= 40) return 'bg-accent-highlight-500';
        return 'bg-accent-amber-600';
    }

    completionTooltip(person: Individual): string {
        const c = this.completionFor(person);
        if (c.missing.length === 0) return `Datenqualität: ${c.score}%\nSehr gut gepflegt.`;
        return `Datenqualität: ${c.score}%\nFehlt: ${c.missing.join(', ')}`;
    }

    toggleSortDirection() {
        this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    }

    private computeCompletion(person: Individual): { score: number; missing: string[] } {
        let points = 0;
        let max = 0;
        const missing: string[] = [];

        const addRule = (ok: boolean, weight: number, label: string) => {
            max += weight;
            if (ok) points += weight;
            else missing.push(label);
        };

        const has = (v: any) => typeof v === 'string' ? v.trim().length > 0 : !!v;
        const hasArray = (a: any) => Array.isArray(a) && a.length > 0;

        // Core identity
        addRule(has(person.firstName) || has(person.lastName), 15, 'Name');
        addRule(person.gender === 'M' || person.gender === 'F' || person.gender === 'X', 8, 'Geschlecht');

        // Life facts (smart for living/deceased)
        const birthKnown = has(person.birthDate) || person.events?.some((e: any) => e.type === 'BIRT' && has(e.date));
        const birthPlaceKnown = has(person.birthPlace) || person.events?.some((e: any) => e.type === 'BIRT' && has(e.place));
        addRule(!!birthKnown, 14, 'Geburtsdatum');
        addRule(!!birthPlaceKnown, 8, 'Geburtsort');

        const isLikelyDeceased = person.isLiving === false || has(person.deathDate);
        if (isLikelyDeceased) {
            addRule(has(person.deathDate), 8, 'Sterbedatum');
            addRule(has(person.deathPlace), 6, 'Sterbeort');
        }

        // Structure and quality
        addRule(hasArray(person.names), 8, 'Namensvarianten');
        addRule(hasArray(person.events) || hasArray(person.facts), 10, 'Ereignisse/Fakten');
        addRule(hasArray(person.parents) || hasArray(person.spouses) || hasArray(person.familiesAsSpouse), 10, 'Familienbezüge');
        addRule(hasArray(person.citations), 8, 'Quellen');
        addRule(hasArray(person.media), 7, 'Medien');
        addRule(hasArray(person.notes), 6, 'Notizen');

        const score = max > 0 ? Math.max(0, Math.min(100, Math.round((points / max) * 100))) : 0;
        return { score, missing: missing.slice(0, 5) };
    }
}
