import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GedcomService } from './gedcom.service';
import { Individual } from './models';
import { FormsModule } from '@angular/forms';
import { CleanDatePipe } from './clean-date.pipe';
import { PersonCreateModal } from './person-create-modal';

@Component({
    selector: 'app-person-list',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, CleanDatePipe, PersonCreateModal],
    templateUrl: './person-list.html',
    styleUrl: './person-list.css'
})
export class PersonList {
    private readonly FOCUS_PERSON_KEY = 'heritago_last_focus_person';
    private gedcomService = inject(GedcomService);
    private router = inject(Router);

    individuals = signal<Individual[]>([]);
    families = signal<any[]>([]);
    loading = signal(true);
    searchTerm = signal('');
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

        const focusId = this.focusedPersonId();
        if (!focusId) return base;

        const familySet = this.relatedPeopleSet(focusId);
        return [...base].sort((a, b) => {
            const pa = this.priorityForPerson(a.id, focusId, familySet);
            const pb = this.priorityForPerson(b.id, focusId, familySet);
            if (pa !== pb) return pa - pb;
            return (a.name || '').localeCompare(b.name || '');
        });
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
}
